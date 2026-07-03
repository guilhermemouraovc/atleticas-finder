/* Atléticas Finder UI */

(function () {
  "use strict";

  document.documentElement.classList.add("js");

  function setupNavbar() {
    var nav = document.getElementById("main-nav");
    var header = document.getElementById("main-header");
    if (!nav || !header) return;

    function check() {
      if (window.scrollY > 20) {
        nav.classList.remove("pt-10", "pb-0");
        nav.classList.add("py-4");
        header.style.borderBottomColor = "var(--color-border)";
      } else {
        nav.classList.remove("py-4");
        nav.classList.add("pt-10", "pb-0");
        header.style.borderBottomColor = "transparent";
      }
    }

    window.addEventListener("scroll", check, { passive: true });
    check();
  }

  function setupMobileMenu() {
    var menuButton = document.getElementById("mobile-menu-button");
    var mobileMenu = document.getElementById("mobile-menu");
    if (!menuButton || !mobileMenu) return;

    menuButton.addEventListener("click", function () {
      var isOpen = menuButton.getAttribute("aria-expanded") === "true";
      menuButton.setAttribute("aria-expanded", String(!isOpen));
      mobileMenu.classList.toggle("hidden", isOpen);
      mobileMenu.setAttribute("aria-hidden", String(isOpen));
    });

    mobileMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        menuButton.setAttribute("aria-expanded", "false");
        mobileMenu.classList.add("hidden");
        mobileMenu.setAttribute("aria-hidden", "true");
      });
    });
  }

  function setupScrollAnimations() {
    var animatedElements = document.querySelectorAll("[data-animate]");
    if (!animatedElements.length || !("IntersectionObserver" in window)) {
      animatedElements.forEach(function (element) {
        element.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    animatedElements.forEach(function (element) {
      observer.observe(element);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupNavbar();
    setupMobileMenu();
    setupScrollAnimations();
    setupApp();
  });

  function setupApp() {
    var form = document.getElementById("search-form");
    var ufFilter = document.getElementById("uf-filter");
    var searchButton = document.getElementById("search-button");
    var exportButton = document.getElementById("export-button");
    var summaryButton = document.getElementById("summary-button");
    var resultsBody = document.getElementById("results-body");
    var resultCount = document.getElementById("result-count");
    var queryProgress = document.getElementById("query-progress");
    var currentFilter = document.getElementById("current-filter");
    var streamStatus = document.getElementById("stream-status");
    var statusDot = document.getElementById("status-dot");
    var summaryText = document.getElementById("summary-text");
    var queryLog = document.getElementById("query-log");
    var logCount = document.getElementById("log-count");
    var emptyState = document.getElementById("empty-state");
    var lastEvent = document.getElementById("last-event");

    if (!form || !ufFilter || !resultsBody) return;

    var state = {
      source: null,
      summaryWindow: null,
      results: [],
      queryCount: 0,
      queryDone: 0,
      streamCompleted: false
    };

    fetch("/config")
      .then(function (response) { return response.json(); })
      .then(function (config) {
        (config.ufs || []).forEach(function (uf) {
          var option = document.createElement("option");
          option.value = uf;
          option.textContent = uf;
          ufFilter.appendChild(option);
        });
      })
      .catch(function () {});

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      startSearch();
    });

    exportButton.addEventListener("click", function () {
      if (!state.results.length) return;

      var rows = [["username", "url", "estado", "nordeste", "universidade", "bio"]];
      state.results.forEach(function (profile) {
        rows.push([
          profile.username || "",
          profile.url || "",
          profile.estado || "",
          profile.nordeste || "",
          profile.universidade || "",
          profile.bio || ""
        ]);
      });

      var csv = rows.map(function (row) {
        return row.map(function (value) {
          return '"' + String(value).replace(/"/g, '""') + '"';
        }).join(",");
      }).join("\n");

      var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "atleticas_sse.csv";
      link.click();
      URL.revokeObjectURL(url);
    });

    if (summaryButton) {
      summaryButton.addEventListener("click", function () {
        openOrRefreshSummaryTab();
      });
    }

    function resetUI() {
      if (state.source) {
        state.source.close();
      }

      state.source = null;
      state.results = [];
      state.queryCount = 0;
      state.queryDone = 0;
      state.streamCompleted = false;

      resultsBody.innerHTML = "";
      queryLog.innerHTML = "";
      resultCount.textContent = "0";
      queryProgress.textContent = "0/0";
      currentFilter.textContent = ufFilter.value || "ALL";
      streamStatus.textContent = "Conectando ao stream SSE...";
      summaryText.textContent = "Inicializando uma nova sessão de busca.";
      logCount.textContent = "0 eventos";
      lastEvent.textContent = "start";
      emptyState.hidden = false;
      exportButton.disabled = true;
      if (summaryButton) summaryButton.disabled = true;
      searchButton.disabled = true;
      searchButton.textContent = "Buscando...";
      setSignal("running");
    }

    function setSignal(mode) {
      statusDot.className = "signal-dot";
      if (mode === "idle") statusDot.classList.add("idle");
      if (mode === "done") statusDot.classList.add("done");
      if (mode === "error") statusDot.classList.add("error");
    }

    function addLog(title, description) {
      var item = document.createElement("article");
      item.className = "log-item";
      item.innerHTML = "<strong>" + escapeHtml(title) + "</strong><p class=\"mt-2 text-sm text-muted-foreground\">" + escapeHtml(description) + "</p>";
      queryLog.prepend(item);
      logCount.textContent = queryLog.childElementCount + " eventos";
    }

    function addRow(profile) {
      state.results.push(profile);
      var profileUrl = profile.url || buildInstagramUrl(profile.username);

      var row = document.createElement("tr");
      row.innerHTML = [
        "<td><div class=\"font-medium\">" + escapeHtml(profile.username || "") + "</div><a class=\"link-button\" href=\"" + escapeAttr(profileUrl || "#") + "\" target=\"_blank\" rel=\"noreferrer\">Abrir no Instagram</a></td>",
        "<td>" + escapeHtml(profile.estado || "--") + "</td>",
        "<td>" + (profile.nordeste ? "<span class=\"tag\">Nordeste</span>" : "--") + "</td>",
        "<td>" + escapeHtml(profile.universidade || "--") + "</td>",
        "<td class=\"text-sm text-muted-foreground\">" + escapeHtml(profile.bio || "Sem bio capturada") + "</td>"
      ].join("");
      resultsBody.appendChild(row);

      resultCount.textContent = String(state.results.length);
      exportButton.disabled = false;
      emptyState.hidden = true;
    }

    function startSearch() {
      resetUI();

      var query = ufFilter.value ? "?uf=" + encodeURIComponent(ufFilter.value) : "";
      var source = new EventSource("/buscar" + query);
      state.source = source;

      source.addEventListener("start", function (event) {
        var payload = JSON.parse(event.data);
        state.queryCount = payload.query_count || 0;
        queryProgress.textContent = "0/" + state.queryCount;
        streamStatus.textContent = "Stream conectado. Rodando " + state.queryCount + " queries.";
        summaryText.textContent = "A API está varrendo resultados e vai emitir um evento para cada perfil novo.";
        addLog("Busca iniciada", "Filtro " + (payload.uf || "ALL") + " com " + state.queryCount + " queries.");
      });

      source.addEventListener("profile", function (event) {
        var profile = JSON.parse(event.data);
        addRow(profile);
        streamStatus.textContent = "Recebendo perfis em tempo real.";
        lastEvent.textContent = "profile";
      });

      source.addEventListener("query_done", function (event) {
        var payload = JSON.parse(event.data);
        state.queryDone += 1;
        queryProgress.textContent = state.queryDone + "/" + state.queryCount;
        addLog("Query finalizada", "+" + payload.new_items + " nova(s): " + payload.query);
        lastEvent.textContent = "query_done";
      });

      source.addEventListener("query_error", function (event) {
        var payload = JSON.parse(event.data);
        state.queryDone += 1;
        queryProgress.textContent = state.queryDone + "/" + state.queryCount;
        addLog("Erro de query", payload.message + " | " + payload.query);
        lastEvent.textContent = "query_error";
      });

      source.addEventListener("done", function (event) {
        var payload = JSON.parse(event.data);
        state.streamCompleted = true;
        searchButton.disabled = false;
        searchButton.textContent = "Iniciar busca";
        if (summaryButton) summaryButton.disabled = !state.results.length;
        streamStatus.textContent = "Busca finalizada com " + payload.total_found + " atléticas.";
        summaryText.textContent = "Stream encerrado com sucesso. Você pode exportar o CSV ou iniciar outra busca.";
        lastEvent.textContent = "done";
        setSignal("done");
        addLog("Busca finalizada", payload.total_found + " perfis únicos recebidos.");
        source.close();
      });

      source.onerror = function () {
        if (state.streamCompleted) return;
        searchButton.disabled = false;
        searchButton.textContent = "Tentar novamente";
        streamStatus.textContent = "A conexão SSE falhou antes do fim da busca.";
        summaryText.textContent = "Verifique o backend FastAPI e reinicie a busca.";
        lastEvent.textContent = "error";
        setSignal("error");
        if (summaryButton) summaryButton.disabled = !state.results.length;
        addLog("Falha no stream", "O EventSource perdeu a conexão com o backend.");
        source.close();
      };
    }

    function ensureSummaryWindow() {
      if (state.summaryWindow && !state.summaryWindow.closed) {
        renderSummaryLoading(state.summaryWindow);
        return state.summaryWindow;
      }

      state.summaryWindow = window.open("", "_blank");
      if (state.summaryWindow) {
        renderSummaryLoading(state.summaryWindow);
      }
      return state.summaryWindow;
    }

    function openOrRefreshSummaryTab() {
      var summaryWindow = ensureSummaryWindow();
      if (!summaryWindow) return;
      renderSummaryResults(summaryWindow);
      summaryWindow.focus();
    }

    function renderSummaryLoading(targetWindow) {
      if (!targetWindow) return;
      targetWindow.document.open();
      targetWindow.document.write(buildSummaryHtml({
        title: "Busca em andamento",
        subtitle: "Aguarde o fim da varredura para ver a lista consolidada.",
        rows: []
      }));
      targetWindow.document.close();
    }

    function renderSummaryResults(targetWindow) {
      if (!targetWindow) return;

      var rows = state.results.map(function (profile) {
        return {
          username: profile.username || "",
          estado: profile.estado || "--",
          universidade: profile.universidade || "--",
          categoria: profile.categoria || "--",
          url: profile.url || buildInstagramUrl(profile.username)
        };
      });

      targetWindow.document.open();
      targetWindow.document.write(buildSummaryHtml({
        title: "Perfis encontrados",
        subtitle: rows.length + " perfil(is) encontrado(s) para o filtro " + (ufFilter.value || "ALL") + ".",
        rows: rows
      }));
      targetWindow.document.close();
    }

    function buildSummaryHtml(data) {
      var rowsHtml = data.rows.length ? data.rows.map(function (row) {
        return [
          "<tr>",
          "<td>" + escapeHtml(row.username) + "</td>",
          "<td>" + escapeHtml(row.estado) + "</td>",
          "<td>" + escapeHtml(row.universidade) + "</td>",
          "<td>" + escapeHtml(row.categoria) + "</td>",
          "<td><a href=\"" + escapeAttr(row.url) + "\" target=\"_blank\" rel=\"noreferrer\">Abrir Instagram</a></td>",
          "</tr>"
        ].join("");
      }).join("") : "<tr><td colspan=\"5\">Nenhum perfil encontrado ainda.</td></tr>";

      return [
        "<!DOCTYPE html>",
        "<html lang=\"pt-BR\">",
        "<head>",
        "<meta charset=\"UTF-8\">",
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">",
        "<title>Perfis encontrados</title>",
        "<style>",
        "body{margin:0;padding:32px;font-family:ui-sans-serif,system-ui,sans-serif;background:#07080b;color:#f3f4f6;}",
        ".shell{max-width:1100px;margin:0 auto;}",
        "h1{font-size:clamp(2rem,4vw,3rem);margin:0 0 12px;}",
        "p{color:#a1a1aa;margin:0 0 24px;}",
        ".card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:24px;}",
        "table{width:100%;border-collapse:collapse;}",
        "th,td{text-align:left;padding:14px 12px;border-bottom:1px solid rgba(255,255,255,.08);}",
        "th{font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:#a1a1aa;}",
        "a{display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.14);color:#f3f4f6;text-decoration:none;}",
        "a:hover{border-color:rgba(124,226,179,.5);background:rgba(124,226,179,.12);}",
        "</style>",
        "</head>",
        "<body>",
        "<div class=\"shell\">",
        "<h1>" + escapeHtml(data.title) + "</h1>",
        "<p>" + escapeHtml(data.subtitle) + "</p>",
        "<div class=\"card\">",
        "<table>",
        "<thead><tr><th>Perfil</th><th>UF</th><th>Origem</th><th>Categoria</th><th>Link</th></tr></thead>",
        "<tbody>",
        rowsHtml,
        "</tbody>",
        "</table>",
        "</div>",
        "</div>",
        "</body>",
        "</html>"
      ].join("");
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function escapeAttr(value) {
      return escapeHtml(value);
    }

    function buildInstagramUrl(username) {
      if (!username) return "";
      return "https://www.instagram.com/" + String(username).replace(/^@+/, "") + "/";
    }
  }
})();
