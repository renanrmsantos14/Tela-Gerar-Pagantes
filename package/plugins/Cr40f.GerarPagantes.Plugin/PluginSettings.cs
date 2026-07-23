using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;

namespace Cr40f.GerarPagantes.Plugin;

public sealed class PluginSettings
{
    public string CieloClientId { get; set; } = string.Empty;
    public string CieloClientSecret { get; set; } = string.Empty;
    public string GraphTenantId { get; set; } = string.Empty;
    public string GraphClientId { get; set; } = string.Empty;
    public string GraphClientSecret { get; set; } = string.Empty;
    public string SenderEmail { get; set; } = string.Empty;
    public string ReplyToEmail { get; set; } = string.Empty;
    public List<string> InternalRecipients { get; set; } = new();
    public string EmailAssetPrefix { get; set; } = "cr40f_/GerarPagantes/email/";

    public static PluginSettings Parse(string unsecureConfiguration, string secureConfiguration)
    {
        var publicSettings = Deserialize<PublicSettings>(unsecureConfiguration);
        var secretSettings = Deserialize<SecretSettings>(secureConfiguration);

        return new PluginSettings
        {
            CieloClientId = publicSettings?.CieloClientId?.Trim() ?? LegacyValue(unsecureConfiguration),
            CieloClientSecret = secretSettings?.CieloClientSecret?.Trim() ?? LegacyValue(secureConfiguration),
            GraphTenantId = publicSettings?.GraphTenantId?.Trim() ?? string.Empty,
            GraphClientId = publicSettings?.GraphClientId?.Trim() ?? string.Empty,
            GraphClientSecret = secretSettings?.GraphClientSecret?.Trim() ?? string.Empty,
            SenderEmail = publicSettings?.SenderEmail?.Trim() ?? string.Empty,
            ReplyToEmail = publicSettings?.ReplyToEmail?.Trim() ?? string.Empty,
            InternalRecipients = publicSettings?.InternalRecipients?
                .Where(IsEmail)
                .Select(value => value.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList() ?? new List<string>(),
            EmailAssetPrefix = string.IsNullOrWhiteSpace(publicSettings?.EmailAssetPrefix)
                ? "cr40f_/GerarPagantes/email/"
                : publicSettings!.EmailAssetPrefix!.Trim()
        };
    }

    public void ValidateFor(GerarPagantesRequest request)
    {
        if (request.Pagantes.Any(payer => payer.GenerateLink) &&
            (string.IsNullOrWhiteSpace(CieloClientId) || string.IsNullOrWhiteSpace(CieloClientSecret)))
            throw new InvalidOperationException("Configuração Cielo ausente no step da Custom API.");

        if (!request.Pagantes.Any(payer => payer.SendEmail)) return;
        if (new[] { GraphTenantId, GraphClientId, GraphClientSecret, SenderEmail }.Any(string.IsNullOrWhiteSpace))
            throw new InvalidOperationException("Configuração Microsoft Graph incompleta no step da Custom API.");
        if (!IsEmail(SenderEmail) || !string.IsNullOrWhiteSpace(ReplyToEmail) && !IsEmail(ReplyToEmail))
            throw new InvalidOperationException("Configuração de remetente ou Reply-To inválida.");
    }

    private static T? Deserialize<T>(string value) where T : class
    {
        if (string.IsNullOrWhiteSpace(value) || !value.TrimStart().StartsWith("{", StringComparison.Ordinal)) return null;
        try { return JsonConvert.DeserializeObject<T>(value); }
        catch (JsonException error) { throw new InvalidOperationException("Configuração JSON inválida no step da Custom API.", error); }
    }

    private static string LegacyValue(string value) => string.IsNullOrWhiteSpace(value) || value.TrimStart().StartsWith("{", StringComparison.Ordinal)
        ? string.Empty
        : value.Trim();

    private static bool IsEmail(string? value) => !string.IsNullOrWhiteSpace(value) &&
        System.Text.RegularExpressions.Regex.IsMatch(value!.Trim(), @"^\S+@\S+\.\S+$");

    private sealed class PublicSettings
    {
        public string? CieloClientId { get; set; }
        public string? GraphTenantId { get; set; }
        public string? GraphClientId { get; set; }
        public string? SenderEmail { get; set; }
        public string? ReplyToEmail { get; set; }
        public List<string>? InternalRecipients { get; set; }
        public string? EmailAssetPrefix { get; set; }
    }

    private sealed class SecretSettings
    {
        public string? CieloClientSecret { get; set; }
        public string? GraphClientSecret { get; set; }
    }
}
