/* Atléticas Finder UI */

(function () {
  "use strict";

  document.documentElement.classList.add("js");

  // ---------------------------------------------------------------------
  // Configuração do Supabase
  // ---------------------------------------------------------------------
  // A "anon key" é pública por design (protegida pelas RLS policies do
  // banco, que só permitem SELECT). Substitua os dois valores abaixo pelos
  // dados do seu projeto Supabase antes do deploy. Veja DEPLOY.md.
  var SUPABASE_URL = "https://hpryzimlhxgvlublyqfb.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_pVGqJ3xBpKCYTqH-sgB37w_u0vEl_g-";
  var SUPABASE_TABLE = "atleticas";

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
      allResults: [],
      filtered: [],
      summaryWindow: null
    };

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      applyFilter();
    });

    ufFilter.addEventListener("change", function () {
      applyFilter();
    });

    exportButton.addEventListener("click", function () {
      if (!state.filtered.length) return;

      var fields = ["username", "url", "estado", "nordeste", "universidade", "categoria", "score", "bio"];
      var rows = [fields];
      state.filtered.forEach(function (profile) {
        rows.push(fields.map(function (field) {
          return profile[field] === null || profile[field] === undefined ? "" : profile[field];
        }));
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
      link.download = "atleticas.csv";
      link.click();
      URL.revokeObjectURL(url);
    });

    if (summaryButton) {
      summaryButton.addEventListener("click", function () {
        openOrRefreshSummaryTab();
      });
    }

    loadData();

    // -----------------------------------------------------------------
    // Carregamento dos dados (Supabase REST API)
    // -----------------------------------------------------------------
    function loadData() {
      setSignal("running");
      streamStatus.textContent = "Carregando atléticas do Supabase...";
      summaryText.textContent = "Buscando os dados mais recentes salvos pelo scraper.";
      searchButton.disabled = true;
      exportButton.disabled = true;
      if (summaryButton) summaryButton.disabled = true;
      lastEvent.textContent = "load";

      var endpoint = SUPABASE_URL + "/rest/v1/" + SUPABASE_TABLE + "?select=*&order=estado.asc";

      fetch(endpoint, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: "Bearer " + SUPABASE_ANON_KEY
        }
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("HTTP " + response.status + " ao consultar o Supabase.");
          }
          return response.json();
        })
        .then(function (rows) {
          state.allResults = Array.isArray(rows) ? rows : [];
          populateUfOptions(state.allResults);
          searchButton.disabled = false;
          addLog("Dados carregados", state.allResults.length + " atlética(s) recebida(s) do Supabase.");
          applyFilter();
        })
        .catch(function (error) {
          searchButton.disabled = false;
          streamStatus.textContent = "Falha ao carregar dados do Supabase.";
          summaryText.textContent = "Verifique SUPABASE_URL / SUPABASE_ANON_KEY em js/main.js e as policies de leitura da tabela.";
          lastEvent.textContent = "error";
          setSignal("error");
          addLog("Erro ao carregar", error.message || String(error));
        });
    }

    function populateUfOptions(rows) {
      var current = ufFilter.value;
      var estados = Array.from(new Set(
        rows.map(function (row) { return row.estado; }).filter(Boolean)
      )).sort();

      ufFilter.innerHTML = '<option value="">Todas as UFs</option>';
      estados.forEach(function (uf) {
        var option = document.createElement("option");
        option.value = uf;
        option.textContent = uf;
        ufFilter.appendChild(option);
      });

      if (current && estados.indexOf(current) !== -1) {
        ufFilter.value = current;
      }
    }

    // -----------------------------------------------------------------
    // Filtro client-side (não dispara nova requisição)
    // -----------------------------------------------------------------
    function applyFilter() {
      var uf = ufFilter.value;
      state.filtered = uf
        ? state.allResults.filter(function (row) { return row.estado === uf; })
        : state.allResults.slice();

      renderTable(state.filtered);

      currentFilter.textContent = uf || "ALL";
      resultCount.textContent = String(state.filtered.length);
      queryProgress.textContent = state.filtered.length + "/" + state.allResults.length;
      exportButton.disabled = state.filtered.length === 0;
      if (summaryButton) summaryButton.disabled = state.filtered.length === 0;
      emptyState.hidden = state.filtered.length !== 0;

      streamStatus.textContent = state.allResults.length
        ? state.filtered.length + " de " + state.allResults.length + " atlética(s) exibida(s)."
        : "Nenhuma atlética encontrada no banco ainda.";
      summaryText.textContent = "Dados carregados do Supabase. O filtro de UF é aplicado localmente, sem nova consulta.";
      lastEvent.textContent = "filter";
      setSignal(state.filtered.length ? "done" : "idle");
      addLog("Filtro aplicado", (uf || "Todas as UFs") + ": " + state.filtered.length + " resultado(s).");
    }

    function renderTable(rows) {
      resultsBody.innerHTML = "";
      rows.forEach(function (profile) {
        addRow(profile);
      });
    }

    function addRow(profile) {
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

    function ensureSummaryWindow() {
      if (state.summaryWindow && !state.summaryWindow.closed) {
        renderSummaryResults(state.summaryWindow);
        return state.summaryWindow;
      }

      state.summaryWindow = window.open("", "_blank");
      return state.summaryWindow;
    }

    function openOrRefreshSummaryTab() {
      var summaryWindow = ensureSummaryWindow();
      if (!summaryWindow) return;
      renderSummaryResults(summaryWindow);
      summaryWindow.focus();
    }

    function renderSummaryResults(targetWindow) {
      if (!targetWindow) return;

      var rows = state.filtered.map(function (profile) {
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
      }).join("") : "<tr><td colspan=\"5\">Nenhum perfil encontrado.</td></tr>";

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
