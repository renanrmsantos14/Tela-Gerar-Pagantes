var Cr40fGerarPagantes = (function () {
  'use strict';

  var OVERLAY_ID = 'cr40f-gerar-pagantes-native-overlay';
  var OVERLAY_STYLE_ID = 'cr40f-gerar-pagantes-native-overlay-style';
  var CLOSE_MESSAGE = 'cr40f-gerar-pagantes:close';

  function getRecordId(selectedItemIds) {
    if (!selectedItemIds) return null;
    if (Array.isArray(selectedItemIds)) {
      if (selectedItemIds.length !== 1) return { count: selectedItemIds.length };
      var item = selectedItemIds[0];
      return typeof item === 'string' ? item : item && (item.Id || item.id);
    }
    return typeof selectedItemIds === 'string' ? selectedItemIds : (selectedItemIds.Id || selectedItemIds.id);
  }

  function alert(title, text) { return Xrm.Navigation.openAlertDialog({ title: title, text: text }); }

  function refreshHost() {
    try {
      if (Xrm.Page && Xrm.Page.data) Xrm.Page.data.refresh(false);
    } catch (error) {
      console.warn('[Cr40fGerarPagantes] Nao foi possivel atualizar o formulario', error);
    }
  }

  // Backdrop e webresource sao irmaos: blur nunca compoe sobre a tela da aplicacao.
  function openNativeOverlay(recordId) {
    var hostWindow = window.top;
    var hostDocument = hostWindow.document;
    var existing = hostDocument.getElementById(OVERLAY_ID);
    if (existing) existing.remove();
    var oldStyle = hostDocument.getElementById(OVERLAY_STYLE_ID);
    if (oldStyle) oldStyle.remove();

    var style = hostDocument.createElement('style');
    style.id = OVERLAY_STYLE_ID;
    style.textContent =
      '#' + OVERLAY_ID + '{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;isolation:isolate;opacity:0;transition:opacity 180ms cubic-bezier(.23,1,.32,1)}' +
      '#' + OVERLAY_ID + '.is-visible{opacity:1}' +
      '#' + OVERLAY_ID + ' .bt-gerar-pagantes-backdrop{position:absolute;inset:0;z-index:0;background:rgba(0,26,61,.32);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}' +
      '#' + OVERLAY_ID + ' iframe{position:relative;z-index:1;display:block;width:100%;height:100%;border:0;background:#fff;box-shadow:none;outline:0}';

    var overlay = hostDocument.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Gerar pagantes');
    var backdrop = hostDocument.createElement('div');
    backdrop.className = 'bt-gerar-pagantes-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    var frame = hostDocument.createElement('iframe');
    frame.title = 'Gerar pagantes';
    frame.setAttribute('allow', 'clipboard-write');
    var clientUrl = Xrm.Utility.getGlobalContext().getClientUrl().replace(/\/$/, '');
    frame.src = clientUrl + '/WebResources/Tela_GerarPagantes/index.html?recordId=' + encodeURIComponent(recordId) + '&embedded=1';
    overlay.appendChild(backdrop);
    overlay.appendChild(frame);
    (hostDocument.head || hostDocument.documentElement).appendChild(style);
    hostDocument.body.appendChild(overlay);

    var closed = false;
    function close(shouldRefresh) {
      if (closed) return;
      closed = true;
      hostWindow.removeEventListener('message', onMessage);
      hostWindow.removeEventListener('keydown', onKeyDown, true);
      overlay.classList.remove('is-visible');
      hostWindow.setTimeout(function () {
        overlay.remove();
        style.remove();
        if (shouldRefresh) refreshHost();
      }, 160);
    }
    function onMessage(event) {
      if (event.origin !== hostWindow.location.origin || event.source !== frame.contentWindow || !event.data || event.data.type !== CLOSE_MESSAGE) return;
      close(Boolean(event.data.refresh));
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
      }
    }
    backdrop.addEventListener('mousedown', function () { close(false); });
    hostWindow.addEventListener('message', onMessage);
    hostWindow.addEventListener('keydown', onKeyDown, true);
    frame.addEventListener('load', function () { frame.focus(); }, { once: true });
    hostWindow.requestAnimationFrame(function () { overlay.classList.add('is-visible'); });
    return close;
  }

  async function abrirPainelRateio(selectedItemIds) {
    try {
      var selected = getRecordId(selectedItemIds);
      if (!selected || (selected && selected.count === 0)) { await alert('Nenhuma OP selecionada', 'Selecione uma OP antes de gerar os pagantes.'); return; }
      if (selected && selected.count > 1) { await alert('Selecao multipla', 'Selecione somente uma OP para gerar os pagantes.'); return; }
      var recordId = String(selected).replace(/[{}]/g, '').trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId)) { await alert('OP invalida', 'Nao foi possivel identificar o registro selecionado.'); return; }

      openNativeOverlay(recordId);
    } catch (error) {
      console.error('[Cr40fGerarPagantes] Falha ao abrir web resource', error);
      await alert('Nao foi possivel abrir a cobranca', 'Tente novamente. Se o problema continuar, informe o horario desta tentativa ao suporte.');
    }
  }

  return { abrirPainelRateio: abrirPainelRateio };
}());
