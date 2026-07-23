using System.Reflection;
using Microsoft.PowerPlatform.Dataverse.Client;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;

var options = Arguments.Parse(args);
var environmentUrl = options.Require("environmentUrl");
var dllPath = options.Require("dllPath");
var solutionUniqueName = options.Require("solutionUniqueName");
var publish = options.Has("publish");
var unsecureConfiguration = options.Optional("unsecureConfiguration");
var secureConfiguration = options.Optional("secureConfiguration");

if ((unsecureConfiguration is null) != (secureConfiguration is null))
{
    throw new InvalidOperationException("As configuracoes Cielo devem ser informadas juntas.");
}

if (!File.Exists(dllPath))
{
    throw new FileNotFoundException("DLL do plugin nao encontrada.", dllPath);
}

const string PluginTypeName = "Cr40f.GerarPagantes.Plugin.GerarPagantesPlugin";
const string CustomApiMessageName = "cr40f_GerarPagantes";
const string BoundEntity = "cr40f_financeiro";
const int PluginAssemblyComponentType = 91;

Log("autenticando no Dataverse");
var connectionString = $"AuthType=OAuth;Url={environmentUrl.TrimEnd('/')};AppId=51f81489-12ee-4a9e-aaae-a2591f45987d;RedirectUri=http://localhost;LoginPrompt=Auto";
using var service = new ServiceClient(connectionString);
if (!service.IsReady)
{
    throw new InvalidOperationException($"Falha ao conectar no Dataverse. {service.LastError}");
}

var assemblyInfo = AssemblyInfo.Read(dllPath);
var assemblyContent = Convert.ToBase64String(File.ReadAllBytes(dllPath));
var assemblyId = UpsertAssembly(service, assemblyInfo, assemblyContent);
var pluginTypeId = UpsertPluginType(service, assemblyId);
EnsureCustomApi(service, pluginTypeId, solutionUniqueName, CustomApiMessageName, BoundEntity);
EnsureSolutionComponent(service, assemblyId, solutionUniqueName, PluginAssemblyComponentType);

if (publish)
{
    // Plugin assemblies nao fazem parte do PublishXml seletivo; o publish global consolida o registro do step.
    Log("publicando customizacoes");
    service.Execute(new OrganizationRequest("PublishAllXml"));
}

Log("plugin publicado com sucesso");

static void Log(string message) => Console.WriteLine($"[gerar-pagantes:plugin] {message}");
static EntityReference Ref(string logicalName, Guid id) => new(logicalName, id);

static Guid UpsertAssembly(ServiceClient service, AssemblyInfo assemblyInfo, string content)
{
    var existing = FindSingleOrNone(service, "pluginassembly", ("name", assemblyInfo.Name));
    if (existing is not null)
    {
        Log($"atualizando assembly {assemblyInfo.Name}");
        service.Update(new Entity("pluginassembly", existing.Id) { ["content"] = content });
        return existing.Id;
    }

    Log($"criando assembly {assemblyInfo.Name}");
    return service.Create(new Entity("pluginassembly")
    {
        ["name"] = assemblyInfo.Name,
        ["content"] = content,
        ["isolationmode"] = new OptionSetValue(2),
        ["sourcetype"] = new OptionSetValue(0),
        ["version"] = assemblyInfo.Version,
        ["culture"] = assemblyInfo.Culture,
        ["publickeytoken"] = assemblyInfo.PublicKeyToken
    });
}

static Guid UpsertPluginType(ServiceClient service, Guid assemblyId)
{
    var existing = FindSingleOrNone(service, "plugintype", ("typename", PluginTypeName));
    if (existing is not null)
    {
        Log($"reutilizando tipo {PluginTypeName}");
        return existing.Id;
    }

    Log($"criando tipo {PluginTypeName}");
    return service.Create(new Entity("plugintype")
    {
        ["name"] = "GerarPagantesPlugin",
        ["friendlyname"] = "GerarPagantesPlugin",
        ["typename"] = PluginTypeName,
        ["pluginassemblyid"] = Ref("pluginassembly", assemblyId)
    });
}

static Guid EnsureCustomApi(ServiceClient service, Guid pluginTypeId, string solutionUniqueName, string customApiMessageName, string boundEntity)
{
    var existing = FindSingleOrNone(service, "customapi", ("uniquename", customApiMessageName));
    if (existing is not null)
    {
        Log($"reutilizando Custom API {customApiMessageName}");
        service.Update(new Entity("customapi", existing.Id)
        {
            ["plugintypeid"] = Ref("plugintype", pluginTypeId)
        });
        return existing.Id;
    }

    Log($"criando Custom API {customApiMessageName}");
    var customApi = new Entity("customapi")
    {
        ["allowedcustomprocessingsteptype"] = new OptionSetValue(0),
        ["bindingtype"] = new OptionSetValue(1),
        ["boundentitylogicalname"] = boundEntity,
        ["description"] = "Gerar pagantes e substituir pagantes existentes com segurança.",
        ["displayname"] = "Gerar Pagantes",
        ["isfunction"] = false,
        ["isprivate"] = false,
        ["name"] = customApiMessageName,
        ["plugintypeid"] = Ref("plugintype", pluginTypeId),
        ["uniquename"] = customApiMessageName,
        ["iscustomizable"] = new BooleanManagedProperty(false)
    };

    var createRequest = new CreateRequest { Target = customApi };
    createRequest["SolutionUniqueName"] = solutionUniqueName;
    var customApiId = ((CreateResponse)service.Execute(createRequest)).id;

    service.Create(new Entity("customapirequestparameter")
    {
        ["customapiid"] = Ref("customapi", customApiId),
        ["description"] = "JSON da solicitação de geração ou substituição de pagantes.",
        ["displayname"] = "Request JSON",
        ["isoptional"] = false,
        ["name"] = $"{customApiMessageName}.cr40f_RequestJson",
        ["type"] = new OptionSetValue(10),
        ["uniquename"] = "cr40f_RequestJson",
        ["iscustomizable"] = new BooleanManagedProperty(false)
    });

    service.Create(new Entity("customapiresponseproperty")
    {
        ["customapiid"] = Ref("customapi", customApiId),
        ["description"] = "JSON do resultado da operação.",
        ["displayname"] = "Response JSON",
        ["name"] = $"{customApiMessageName}.cr40f_ResponseJson",
        ["type"] = new OptionSetValue(10),
        ["uniquename"] = "cr40f_ResponseJson",
        ["iscustomizable"] = new BooleanManagedProperty(false)
    });

    return customApiId;
}

static void EnsureSolutionComponent(ServiceClient service, Guid componentId, string solutionUniqueName, int componentType)
{
    try
    {
        service.Execute(new OrganizationRequest("AddSolutionComponent")
        {
            ["ComponentId"] = componentId,
            ["ComponentType"] = componentType,
            ["SolutionUniqueName"] = solutionUniqueName,
            ["AddRequiredComponents"] = true
        });
        Log($"assembly incluido na solucao {solutionUniqueName}");
    }
    catch (Exception error) when (error.Message.Contains("already", StringComparison.OrdinalIgnoreCase) || error.Message.Contains("ja existe", StringComparison.OrdinalIgnoreCase))
    {
        Log($"assembly ja pertence a solucao {solutionUniqueName}");
    }
}

static Entity? FindSingleOrNone(ServiceClient service, string logicalName, params (string Attribute, object Value)[] conditions)
{
    var query = new QueryExpression(logicalName)
    {
        ColumnSet = new ColumnSet($"{logicalName}id"),
        TopCount = 2
    };
    foreach (var condition in conditions) query.Criteria.AddCondition(condition.Attribute, ConditionOperator.Equal, condition.Value);
    var rows = service.RetrieveMultiple(query).Entities;
    if (rows.Count > 1) throw new InvalidOperationException($"Mais de um registro encontrado: {logicalName}.");
    return rows.SingleOrDefault();
}

internal sealed record AssemblyInfo(string Name, string Version, string Culture, string PublicKeyToken)
{
    public static AssemblyInfo Read(string dllPath)
    {
        var name = AssemblyName.GetAssemblyName(dllPath);
        var token = name.GetPublicKeyToken();
        var publicKeyToken = token is null || token.Length == 0 ? string.Empty : string.Concat(token.Select(value => value.ToString("x2")));
        return new AssemblyInfo(name.Name ?? throw new InvalidOperationException("Assembly sem nome."), name.Version?.ToString() ?? "1.0.0.0", string.IsNullOrWhiteSpace(name.CultureName) ? "neutral" : name.CultureName, publicKeyToken);
    }
}

internal sealed class Arguments
{
    private readonly Dictionary<string, string?> _values;
    private Arguments(Dictionary<string, string?> values) => _values = values;

    public static Arguments Parse(string[] args)
    {
        var values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        for (var index = 0; index < args.Length; index++)
        {
            var key = args[index];
            if (!key.StartsWith("--", StringComparison.Ordinal)) throw new InvalidOperationException($"Argumento invalido: {key}");
            var name = key[2..];
            var value = index + 1 < args.Length && !args[index + 1].StartsWith("--", StringComparison.Ordinal) ? args[++index] : null;
            values[name] = value;
        }
        return new Arguments(values);
    }

    public string Require(string name) => Optional(name) ?? throw new InvalidOperationException($"Argumento obrigatorio: --{name}");
    public string? Optional(string name) => _values.TryGetValue(name, out var value) ? value : null;
    public bool Has(string name) => _values.ContainsKey(name);
}
