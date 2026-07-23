using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;

namespace Cr40f.GerarPagantes.Plugin;

public sealed class GerarPagantesPlugin : IPlugin
{
    private const string Financeiro = "cr40f_financeiro";
    private const string Pagantes = "cr40f_pagantes";
    private const string Composicao = "cr40f_composicaodeprecos";
    private const string Servico = "cr40f_reservadeveculos";
    private const string Operacao = "cr40f_geracaopagantesoperacao";
    private const string Limpeza = "cr40f_cielolinkcleanup";
    private readonly string _clientId;
    private readonly string _clientSecret;

    public GerarPagantesPlugin(string unsecureConfiguration, string secureConfiguration)
    {
        _clientId = unsecureConfiguration ?? string.Empty;
        _clientSecret = secureConfiguration ?? string.Empty;
    }

    public void Execute(IServiceProvider serviceProvider)
    {
        var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
        var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
        var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
        var service = factory.CreateOrganizationService(context.UserId);
        var logWriter = new OperationalLogWriter(service, tracing);
        var response = new GerarPagantesResponse();
        try
        {
            var target = GetTarget(context);
            var request = DeserializeRequest(context);
            response.RequestId = request.RequestId;
            response.FinanceiroId = target.Id;
            if (request.RequestId == Guid.Empty) throw new InvalidPluginExecutionException("requestId é obrigatório.");
            if (IsProcessed(service, request.RequestId)) throw new InvalidPluginExecutionException("Esta solicitação já foi processada.");
            var finance = service.Retrieve(Financeiro, target.Id, new ColumnSet("versionnumber", "cr40f_id"));
            ValidateVersion(finance, request.ExpectedFinanceiroVersion);
            var totalCents = CalculateOperationTotal(service, target.Id);
            ValidateRequest(request, totalCents);
            response.TotalCents = totalCents;
            var existing = LoadExistingPayers(service, target.Id);
            var cielo = new CieloClient(_clientId, _clientSecret);
            var createdLinks = new List<string>();
            try
            {
                foreach (var payer in request.Pagantes)
                {
                    var existingPayer = payer.ExistingPaganteId.HasValue && existing.TryGetValue(payer.ExistingPaganteId.Value, out var row) ? row : null;
                    var result = UpsertPayer(service, cielo, finance, target.Id, payer, existingPayer, request.RequestId, createdLinks);
                    response.Results.Add(result);
                }
                QueueRemovedPayers(service, existing, request.Pagantes.Select(p => p.ExistingPaganteId).Where(id => id.HasValue).Select(id => id!.Value));
                WriteOperation(service, request.RequestId, target.Id, true, response);
                response.Success = true;
            }
            catch (Exception operationError)
            {
                foreach (var linkId in createdLinks)
                {
                    try { cielo.DeleteLinkAsync(linkId).GetAwaiter().GetResult(); }
                    catch (Exception cleanupError) { QueueCleanup(service, linkId, cleanupError.Message); }
                }
                throw new InvalidPluginExecutionException("Não foi possível concluir a geração dos pagantes. " + Sanitize(operationError.Message), operationError);
            }
        }
        catch (Exception error)
        {
            tracing.Trace("cr40f_GerarPagantes: {0}", error);
            logWriter.TryWriteError(context, error);
            throw error is InvalidPluginExecutionException
                ? error
                : new InvalidPluginExecutionException("Não foi possível concluir a geração dos pagantes. " + Sanitize(error.Message), error);
        }
        context.OutputParameters["cr40f_ResponseJson"] = JsonConvert.SerializeObject(response);
    }

    private static EntityReference GetTarget(IPluginExecutionContext context)
    {
        if (!context.InputParameters.Contains("Target") || context.InputParameters["Target"] is not EntityReference target || target.LogicalName != Financeiro)
            throw new InvalidPluginExecutionException("A Custom API deve ser vinculada a uma OP.");
        return target;
    }

    private static GerarPagantesRequest DeserializeRequest(IPluginExecutionContext context)
    {
        var json = context.InputParameters.Contains("cr40f_RequestJson") ? context.InputParameters["cr40f_RequestJson"] as string : null;
        return !string.IsNullOrWhiteSpace(json) ? JsonConvert.DeserializeObject<GerarPagantesRequest>(json) ?? throw new InvalidPluginExecutionException("Payload inválido.") : throw new InvalidPluginExecutionException("cr40f_RequestJson é obrigatório.");
    }

    private static void ValidateVersion(Entity finance, string expectedVersion)
    {
        var current = finance.GetAttributeValue<long?>("versionnumber")?.ToString(CultureInfo.InvariantCulture) ?? string.Empty;
        if (string.IsNullOrWhiteSpace(expectedVersion) || !string.Equals(current, expectedVersion, StringComparison.Ordinal))
            throw new InvalidPluginExecutionException("A OP foi alterada por outro usuário. Atualize os dados antes de salvar.");
    }

    private static void ValidateRequest(GerarPagantesRequest request, int totalCents)
    {
        if (!request.Pagantes.Any()) throw new InvalidPluginExecutionException("Selecione ao menos um pagante.");
        if (request.Pagantes.GroupBy(p => p.PaganteId).Any(group => group.Key == Guid.Empty || group.Count() > 1)) throw new InvalidPluginExecutionException("Existem pagantes inválidos ou duplicados.");
        if (request.Pagantes.Any(p => p.AmountCents <= 0)) throw new InvalidPluginExecutionException("Todos os pagantes devem possuir valor maior que zero.");
        if (request.Pagantes.Sum(p => p.AmountCents) != totalCents) throw new InvalidPluginExecutionException("O total do rateio diverge do valor da OP.");
    }

    private static int CalculateOperationTotal(IOrganizationService service, Guid financeiroId)
    {
        var services = service.RetrieveMultiple(new QueryExpression(Servico)
        {
            ColumnSet = new ColumnSet(false),
            Criteria = new FilterExpression(LogicalOperator.And)
            {
                Conditions = { new ConditionExpression("cr40f_financeiro", ConditionOperator.Equal, financeiroId) }
            }
        }).Entities;
        if (!services.Any()) throw new InvalidPluginExecutionException("Esta OP não possui serviços vinculados.");
        var compositions = service.RetrieveMultiple(new QueryExpression(Composicao)
        {
            ColumnSet = new ColumnSet("new_valortotal"),
            Criteria = new FilterExpression(LogicalOperator.And)
            {
                Conditions = { new ConditionExpression("cr40f_servicorelacionadogeral", ConditionOperator.In, services.Select(item => item.Id).Cast<object>().ToArray()) }
            }
        }).Entities;
        var cents = compositions.Sum(row => (int)Math.Round((row.GetAttributeValue<Money>("new_valortotal")?.Value ?? 0m) * 100m, MidpointRounding.AwayFromZero));
        if (cents <= 0) throw new InvalidPluginExecutionException("A OP não possui composição de preço válida.");
        return cents;
    }

    private static Dictionary<Guid, Entity> LoadExistingPayers(IOrganizationService service, Guid financeiroId) => service.RetrieveMultiple(new QueryExpression(Pagantes)
    {
        ColumnSet = new ColumnSet("cr40f_bancodedados", "cr40f_valor", "cr40f_formadepagamento", "cr40f_cielolinkid", "cr40f_linkdepagamento"),
        Criteria = new FilterExpression(LogicalOperator.And) { Conditions = { new ConditionExpression("cr40f_financeiro", ConditionOperator.Equal, financeiroId) } }
    }).Entities.ToDictionary(entity => entity.Id);

    private PaganteResult UpsertPayer(IOrganizationService service, CieloClient cielo, Entity finance, Guid financeiroId, PaganteRequest payer, Entity? existing, Guid requestId, ICollection<string> createdLinks)
    {
        var changed = existing == null || existing.GetAttributeValue<EntityReference>("cr40f_bancodedados")?.Id != payer.PaganteId || Math.Round((existing.GetAttributeValue<Money>("cr40f_valor")?.Value ?? 0m) * 100m) != payer.AmountCents || existing.GetAttributeValue<OptionSetValue>("cr40f_formadepagamento")?.Value != payer.PaymentMethod;
        var entity = existing ?? new Entity(Pagantes);
        entity["cr40f_financeiro"] = new EntityReference(Financeiro, financeiroId);
        entity["cr40f_bancodedados"] = new EntityReference("cr40f_bancodedados", payer.PaganteId);
        entity["cr40f_valor"] = new Money(payer.AmountCents / 100m);
        entity["cr40f_formadepagamento"] = new OptionSetValue(payer.PaymentMethod);
        entity["cr40f_status"] = new OptionSetValue(202410001);
        var result = new PaganteResult { PaganteId = payer.PaganteId, LinkStatus = payer.GenerateLink ? "Pending" : "NotApplicable", EmailStatus = payer.SendEmail ? "Pending" : "NotApplicable" };
        if (payer.GenerateLink && changed)
        {
            var link = cielo.CreateLinkAsync(CreateOrderNumber(financeiroId, payer.PaganteId, requestId), "Serviço Betinhos", "Serviços de transporte executivo", payer.AmountCents).GetAwaiter().GetResult();
            createdLinks.Add(link.Id!);
            entity["cr40f_cielolinkid"] = link.Id;
            entity["cr40f_linkdepagamento"] = link.ShortUrl;
            entity["cr40f_cieloordernumber"] = CreateOrderNumber(financeiroId, payer.PaganteId, requestId);
            entity["cr40f_statusgeracaolink"] = new OptionSetValue(202410002);
            result.LinkStatus = "Generated";
            result.PaymentUrl = link.ShortUrl;
        }
        entity["cr40f_statusenvioemail"] = new OptionSetValue(payer.SendEmail ? 202410001 : 202410000);
        if (existing == null)
        {
            result.PagantesRecordId = service.Create(entity);
        }
        else
        {
            service.Update(entity);
            result.PagantesRecordId = existing.Id;
        }
        return result;
    }

    private static void QueueRemovedPayers(IOrganizationService service, IReadOnlyDictionary<Guid, Entity> existing, IEnumerable<Guid> retained)
    {
        var keep = new HashSet<Guid>(retained);
        foreach (var row in existing.Where(item => !keep.Contains(item.Key)).Select(item => item.Value))
        {
            var linkId = row.GetAttributeValue<string>("cr40f_cielolinkid");
            if (!string.IsNullOrWhiteSpace(linkId)) QueueCleanup(service, linkId, "Substituído pelo rateio atual.");
            service.Delete(Pagantes, row.Id);
        }
    }

    private static void QueueCleanup(IOrganizationService service, string cieloLinkId, string reason) => service.Create(new Entity(Limpeza)
    {
        ["cr40f_cielolinkid"] = cieloLinkId,
        ["cr40f_ultimoerro"] = Sanitize(reason)
    });

    private static void WriteOperation(IOrganizationService service, Guid requestId, Guid financeiroId, bool success, GerarPagantesResponse response) => service.Create(new Entity(Operacao)
    {
        ["cr40f_requestid"] = requestId.ToString("D"),
        ["cr40f_financeiro"] = new EntityReference(Financeiro, financeiroId),
        ["cr40f_sucesso"] = success,
        ["cr40f_resultado"] = JsonConvert.SerializeObject(response)
    });

    private static bool IsProcessed(IOrganizationService service, Guid requestId) => service.RetrieveMultiple(new QueryExpression(Operacao)
    {
        ColumnSet = new ColumnSet(false), TopCount = 1,
        Criteria = new FilterExpression(LogicalOperator.And) { Conditions = { new ConditionExpression("cr40f_requestid", ConditionOperator.Equal, requestId.ToString("D")) } }
    }).Entities.Any();

    private static string CreateOrderNumber(Guid financeiroId, Guid payerId, Guid requestId) => (financeiroId.ToString("N") + payerId.ToString("N") + requestId.ToString("N")).Substring(0, 20).ToUpperInvariant();
    private static string Sanitize(string message) => string.IsNullOrWhiteSpace(message) ? "Erro não detalhado." : message.Length > 500 ? message.Substring(0, 500) : message;
}
