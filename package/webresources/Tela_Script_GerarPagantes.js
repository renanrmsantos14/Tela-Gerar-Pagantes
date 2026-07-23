var Cr40fGerarPagantes = (function () {
  'use strict';

  var HOST_BLUR_ID = 'cr40f-gerar-pagantes-host-blur';
  var HOST_BLUR_STYLE_ID = 'cr40f-gerar-pagantes-host-blur-style';

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

  // O diálogo do Dynamics não expõe uma API de blur do host. Este overlay é isolado,
  // não captura eventos e é sempre removido no finally. Se o host bloquear acesso,
  // o diálogo oficial continua funcionando sem blur.
  function installHostBlur() {
    try {
      var hostDocument = window.top.document;
      var overlay = hostDocument.createElement('div');
      overlay.id = HOST_BLUR_ID;
      overlay.setAttribute('aria-hidden', 'true');
      var style = hostDocument.createElement('style');
      style.id = HOST_BLUR_STYLE_ID;
      style.textContent = '#' + HOST_BLUR_ID + '{position:fixed;inset:0;z-index:2147483000;pointer-events:none;background:rgba(0,26,61,.32);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);opacity:0;transition:opacity 180ms cubic-bezier(.23,1,.32,1)} #' + HOST_BLUR_ID + '.is-visible{opacity:1}';
      (hostDocument.head || hostDocument.documentElement).appendChild(style);
      hostDocument.body.appendChild(overlay);
      requestAnimationFrame(function () { overlay.classList.add('is-visible'); });
      var observer = new MutationObserver(function () {
        var dialogs = Array.prototype.slice.call(hostDocument.querySelectorAll('[role="dialog"]'));
        var dialog = dialogs[dialogs.length - 1];
        if (!dialog || dialog === overlay) return;
        var zIndex = Number.parseInt(hostDocument.defaultView.getComputedStyle(dialog).zIndex, 10);
        if (Number.isFinite(zIndex) && zIndex > 1) overlay.style.zIndex = String(Math.max(1, zIndex - 1));
      });
      observer.observe(hostDocument.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
      return function removeHostBlur() {
        observer.disconnect();
        overlay.remove();
        style.remove();
      };
    } catch (error) {
      console.warn('[Cr40fGerarPagantes] Blur do host indisponível', error);
      return function removeHostBlurFallback() {};
    }
  }

  async function abrirPainelRateio(selectedItemIds) {
    var removeHostBlur = function () {};
    try {
      var selected = getRecordId(selectedItemIds);
      if (!selected || (selected && selected.count === 0)) { await alert('Nenhuma OP selecionada', 'Selecione uma OP antes de gerar os pagantes.'); return; }
      if (selected && selected.count > 1) { await alert('Seleção múltipla', 'Selecione somente uma OP para gerar os pagantes.'); return; }
      var recordId = String(selected).replace(/[{}]/g, '').trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId)) { await alert('OP inválida', 'Não foi possível identificar o registro selecionado.'); return; }
      removeHostBlur = installHostBlur();
      var result = await Xrm.Navigation.navigateTo({ pageType: 'webresource', webresourceName: 'Tela_GerarPagantes/index.html', data: JSON.stringify({ recordId: recordId }) }, { target: 2, width: { value: 820, unit: 'px' }, height: { value: 860, unit: 'px' }, position: 1 });
      if (result && result.saved && Xrm.Page && Xrm.Page.data) Xrm.Page.data.refresh(false);
    } catch (error) {
      console.error('[Cr40fGerarPagantes] Falha ao abrir web resource', error);
      await alert('Não foi possível abrir a cobrança', 'Tente novamente. Se o problema continuar, informe o horário desta tentativa ao suporte.');
    } finally { removeHostBlur(); }
  }

  return { abrirPainelRateio: abrirPainelRateio };
}());
