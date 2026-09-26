(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const l of document.querySelectorAll('link[rel="modulepreload"]'))s(l);new MutationObserver(l=>{for(const i of l)if(i.type==="childList")for(const p of i.addedNodes)p.tagName==="LINK"&&p.rel==="modulepreload"&&s(p)}).observe(document,{childList:!0,subtree:!0});function n(l){const i={};return l.integrity&&(i.integrity=l.integrity),l.referrerPolicy&&(i.referrerPolicy=l.referrerPolicy),l.crossOrigin==="use-credentials"?i.credentials="include":l.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(l){if(l.ep)return;l.ep=!0;const i=n(l);fetch(l.href,i)}})();var j="apsql.theme.v12";function x(){const t=localStorage.getItem(j);return t==="light"||t==="dark"||t==="system"?t:"system"}function I(t){localStorage.setItem(j,t);const e=t==="system"?window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light":t;document.documentElement.setAttribute("data-theme",e),document.documentElement.setAttribute("data-theme-pref",t)}function K(){I(x()),window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{x()==="system"&&I("system")})}var z={menu:'<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/>',table:'<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="4" x2="9" y2="20"/>',filter:'<polygon points="4,4 20,4 14,12 14,18 10,20 10,12"/>',code:'<polyline points="8,6 2,12 8,18"/><polyline points="16,6 22,12 16,18"/>',bug:'<circle cx="12" cy="14" r="6"/><path d="M12 8V5"/><path d="M8 5l1.5 2"/><path d="M16 5l-1.5 2"/><path d="M6 14H3"/><path d="M21 14h-3"/><path d="M6.5 19 4 21"/><path d="M17.5 19 20 21"/><path d="M6.5 9.5 4 8"/><path d="M17.5 9.5 20 8"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',moon:'<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',monitor:'<rect x="3" y="4" width="18" height="12" rx="2"/><line x1="8" y1="20" x2="16" y2="20"/><line x1="12" y1="16" x2="12" y2="20"/>',info:'<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none"/>',download:'<path d="M12 3v12"/><polyline points="7,10 12,15 17,10"/><path d="M5 19h14"/>',upload:'<path d="M12 21V9"/><polyline points="7,14 12,9 17,14"/><path d="M5 5h14"/>',lock:'<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',shield:'<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',trash:'<polyline points="4,7 20,7"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 7V4h6v3"/>',copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',play:'<polygon points="6,4 20,12 6,20"/>',wand:'<path d="M4 20 L16 8"/><path d="M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/><path d="M18 12l.7 1.3 1.3.7-1.3.7-.7 1.3-.7-1.3-1.3-.7 1.3-.7z"/>',compass:'<circle cx="12" cy="12" r="9"/><polygon points="15,9 13,13 9,15 11,11"/>',check:'<polyline points="4,12 9,17 20,6"/>',x:'<line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/>',"chevron-right":'<polyline points="9,5 16,12 9,19"/>',"chevron-left":'<polyline points="15,5 8,12 15,19"/>',search:'<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',link:'<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',save:'<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h8V4"/><path d="M8 14h8v6H8z"/>',"alert-triangle":'<path d="M12 4 22 20H2z"/><line x1="12" y1="10" x2="12" y2="15"/><circle cx="12" cy="18" r="0.6" fill="currentColor" stroke="none"/>',logo:'<rect x="2" y="2" width="20" height="20" rx="5" fill="currentColor" opacity="0.12" stroke="none"/><ellipse cx="12" cy="7.5" rx="6" ry="2.2"/><path d="M6 7.5v5c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2v-5"/><path d="M6 12.5v4c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2v-4"/>'};function d(t,e=18,n=""){return`<svg class="icon-badge-svg ${n}" width="${e}" height="${e}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${z[t]}</svg>`}function Z(t,e,n){const s=document.createElement("nav");s.className="navbar",s.innerHTML=`
    <div class="container-fluid">
      <button class="navbar-toggler" id="navToggle" type="button" aria-label="Toggle navigation">
        ${d("menu",22)}
      </button>
      <div class="hero-brand-row" data-tour="brand">
        <span class="app-logo-badge">${d("logo",26)}</span>
        <div class="brand-text">
          <span class="builder-heading">AP-SQL Assistant</span>
          <span class="small">Version 12.0 · TypeScript + Vite</span>
        </div>
      </div>

      <div class="navbar-collapse" id="navbarFitCollapse">
        <ul class="nav-links">
          <li><a href="#quickstart" data-route="quickstart" class="nav-link ${t==="quickstart"?"active":""}">${d("compass")}<span>Quick Start</span></a></li>
          <li><a href="#readonly" data-tour="nav-readonly" data-route="readonly" class="nav-link ${t==="readonly"?"active":""}">${d("table")}<span>Read Only Query Builder</span></a></li>
          <li><a href="#cr" data-tour="nav-cr" data-route="cr" class="nav-link ${t==="cr"?"active":""}">${d("code")}<span>Query Builder for CR</span></a></li>
          <li><a href="#schema-used" data-tour="nav-schema" data-route="schema-used" class="nav-link ${t==="schema-used"||t==="schema-update"?"active":""}">${d("database")}<span>Schema</span></a></li>
          <li><a href="#error" data-tour="nav-error" data-route="error" class="nav-link ${t==="error"?"active":""}">${d("bug")}<span>Error Rectifier</span></a></li>
          <li><a href="#about" data-route="about" class="nav-link ${t==="about"?"active":""}">${d("info")}<span>About</span></a></li>
        </ul>

        <div class="sync-schedule-row">
          <button id="tourBtn" class="btn btn-outline btn-sm" type="button">${d("play",16)}<span class="sync-schedule-label-text">Guided Walkthrough</span></button>
          <div class="theme-toggle-wrap" data-tour="theme-toggle">
            <button id="themeBtn" class="btn btn-ghost btn-sm icon-only" type="button" aria-haspopup="true" aria-expanded="false" title="Theme">
              ${d("monitor",18)}
            </button>
            <div id="themeMenu" class="theme-menu" hidden>
              <button data-theme-choice="system" type="button">${d("monitor",15)} System Default</button>
              <button data-theme-choice="light" type="button">${d("sun",15)} Light</button>
              <button data-theme-choice="dark" type="button">${d("moon",15)} Dark</button>
            </div>
          </div>
          <span class="creator-signature-wrap small">Crafted by Subham Ain</span>
        </div>
      </div>
    </div>`,s.querySelectorAll("[data-route]").forEach(b=>{b.addEventListener("click",f=>{f.preventDefault(),e(b.dataset.route),s.querySelector(".navbar-collapse")?.classList.remove("open")})}),s.querySelector("#navToggle")?.addEventListener("click",()=>{s.querySelector(".navbar-collapse")?.classList.toggle("open")}),s.querySelector("#tourBtn")?.addEventListener("click",n);const l=s.querySelector("#themeBtn"),i=s.querySelector("#themeMenu");l?.addEventListener("click",()=>{const b=i?.hasAttribute("hidden");b?i?.removeAttribute("hidden"):i?.setAttribute("hidden",""),l.setAttribute("aria-expanded",String(!!b))}),document.addEventListener("click",b=>{s.contains(b.target)||i?.setAttribute("hidden","")}),s.querySelectorAll("[data-theme-choice]").forEach(b=>{b.addEventListener("click",()=>{I(b.dataset.themeChoice),i?.setAttribute("hidden",""),p()})});function p(){const b=x(),f=b==="light"?"sun":b==="dark"?"moon":"monitor";l&&(l.innerHTML=d(f,18))}return p(),s}function X(t,e){const n=document.createElement("section");n.className="page page-quickstart";const s=Array.from(new Set(t.tables.map(l=>l.module)));return n.innerHTML=`
    <div class="hero-card">
      <h1>Welcome — what does this tool do?</h1>
      <p class="lead">AP-SQL Assistant · Version 12.0. This assistant writes database queries for you — both read-only
      reports and Change Request SQL (INSERT / UPDATE / DELETE text) — using your organization's approved database
      schema as its single source of truth, and helps you correct a SQL query when a database gives you back an
      error. Build a query by describing what you need in plain language, by making manual selections, or both
      together.</p>
    </div>

    <h2 class="section-title">${d("database")} Areas covered by the active schema</h2>
    <div class="chip-row">
      ${s.map(l=>`<span class="chip">${l}</span>`).join("")}
    </div>

    <h2 class="section-title">${d("play")} Try an example</h2>
    <div class="card-grid">
      <div class="feature-card" data-nav="readonly">
        <div class="feature-icon">${d("table",22)}</div>
        <h3>Read Only Query Builder</h3>
        <p>Describe what you need in plain language and click Build Query, make selections manually, or combine both.</p>
        <span class="card-link">Open Read Only Query Builder ${d("chevron-right",16)}</span>
      </div>
      <div class="feature-card" data-nav="cr">
        <div class="feature-icon">${d("code",22)}</div>
        <h3>Query Builder for CR <span class="badge">CR</span></h3>
        <p>Describe the change in plain language and click Build Query, or use the manual controls.</p>
        <span class="card-link">Open Query Builder for CR ${d("chevron-right",16)}</span>
      </div>
      <div class="feature-card" data-nav="error">
        <div class="feature-icon">${d("bug",22)}</div>
        <h3>Error Rectifier <span class="badge">V12</span></h3>
        <p>Paste a database error and the SQL that caused it, and get a corrected query with a plain-language explanation.</p>
        <span class="card-link">Open Error Rectifier ${d("chevron-right",16)}</span>
      </div>
      <div class="feature-card" data-nav="schema-used">
        <div class="feature-icon">${d("database",22)}</div>
        <h3>Schema</h3>
        <p>Browse the active schema, or use an administrator password to update it and import a new one.</p>
        <span class="card-link">Open Schema ${d("chevron-right",16)}</span>
      </div>
    </div>

    <div class="note-box">
      ${d("shield",16)}
      <div>
        <strong>No execution, ever.</strong> AP-SQL Assistant only ever produces SQL text for you to review and copy.
        It never connects to a real database and never executes a query.
      </div>
    </div>`,n.querySelectorAll("[data-nav]").forEach(l=>{l.addEventListener("click",()=>e(l.dataset.nav))}),n}var Q=["IS NULL","IS NOT NULL"],ee=["IN","NOT IN","IS ONE OF","IS NOT ONE OF"];function k(t){const e=t.trim();return e===""?"''":/^-?\d+(\.\d+)?$/.test(e)||e.startsWith("'")&&e.endsWith("'")?e:`'${e.replace(/'/g,"''")}'`}function te(t){return`(${t.split(",").map(e=>e.trim()).filter(e=>e.length>0).map(k).join(", ")})`}function ne(t){const e=`${t.table}.${t.column}`;if(Q.includes(t.operator))return`${e} ${t.operator}`;if(ee.includes(t.operator))return`${e} ${t.operator==="IS ONE OF"?"IN":t.operator==="IS NOT ONE OF"?"NOT IN":t.operator} ${te(t.value)}`;if(t.operator==="LIKE"||t.operator==="NOT LIKE"){const n=t.value.includes("%")?t.value:`%${t.value}%`;return`${e} ${t.operator} ${k(n)}`}return`${e} ${t.operator} ${k(t.value)}`}function F(t){if(t.length===0)return"";const e=[];return t.forEach((n,s)=>{const l=ne(n);s===0?e.push(l):e.push(`${n.combinator} ${l}`)}),e.join(`
  `)}function W(t){return!Q.includes(t)}var G=["=","<>",">",">=","<","<=","LIKE","NOT LIKE","IS NULL","IS NOT NULL","IN","NOT IN","IS ONE OF","IS NOT ONE OF"];function ae(t,e,n,s){const l=`${e}.${t.name}`;if(!t.decode)return l;const i=Object.entries(t.decode),p=s||`${t.name}_DESC`;return n==="Oracle"?`DECODE(${l}, ${i.map(([b,f])=>`'${b}', '${f.replace(/'/g,"''")}'`).join(", ")}, ${l}) AS ${p}`:`CASE
${i.map(([b,f])=>`    WHEN ${l} = '${b}' THEN '${f.replace(/'/g,"''")}'`).join(`
`)}
    ELSE ${l}
  END AS ${p}`}function le(t){return t.decode?Object.entries(t.decode).map(([e,n])=>`${e} = ${n}`).join(", "):""}function B(t,e){return t.tables.find(n=>n.name===e)}function ie(t,e){if(!e||e<=0)return{top:"",tail:""};switch(t){case"SQL Server":return{top:`TOP ${e} `,tail:""};case"Oracle":return{top:"",tail:`
FETCH FIRST ${e} ROWS ONLY`};default:return{top:"",tail:`
LIMIT ${e}`}}}function U(t,e){if(!t.primaryTable)return"-- Select a table to begin building your query.";const n=B(e,t.primaryTable);if(!n)return`-- Unknown table: ${t.primaryTable}`;const{top:s,tail:l}=ie(t.dialect,t.limit),i=t.columns.length?t.columns.map(o=>{const g=B(e,o.table)?.columns.find(u=>u.name===o.column);if(!g)return`${o.table}.${o.column}`;if(o.useDecode&&g.decode)return`  ${ae(g,o.table,t.dialect,o.alias||void 0)}`;const S=o.alias?` AS ${o.alias}`:"";return`  ${o.table}.${o.column}${S}`}).join(`,
`):`  ${n.name}.*`,p=t.joins.map(o=>`${o.joinType} ${o.table} ON ${t.primaryTable}.${o.onLeftColumn} = ${o.table}.${o.onRightColumn}`).join(`
`),b=F(t.filters),f=t.sorts.length?t.sorts.map(o=>`${o.table}.${o.column} ${o.direction}`).join(", "):"";let h=`SELECT ${s}${t.distinct?`DISTINCT
`:`
`}${i}
FROM ${n.name}`;if(p&&(h+=`
${p}`),b&&(h+=`
WHERE ${b}`),t.havingClause.trim()&&(h+=`
HAVING ${t.havingClause.trim()}`),f&&(h+=`
ORDER BY ${f}`),h+=l,t.recursive){const o=n.columns.find(g=>g.pk)?.name||"ID";h=`WITH RECURSIVE hierarchy AS (
  SELECT ${n.name}.*, 0 AS depth
  FROM ${n.name}
  WHERE ${n.name}.${o} = :root_id
  UNION ALL
  SELECT child.*, hierarchy.depth + 1
  FROM ${n.name} child
  JOIN hierarchy ON child.PARENT_ID = hierarchy.${o}
)
SELECT * FROM hierarchy`+l}return t.saveAsView&&t.saveAsView.trim()?`WITH ${t.saveAsView.trim()} AS (
${h.split(`
`).map(o=>"  "+o).join(`
`)}
)
SELECT * FROM ${t.saveAsView.trim()}${l}`:h}function re(t){const e=[];t.primaryTable||e.push("Select at least one table to query."),t.limit!==null&&t.limit<=0&&e.push("Result limit must be a positive number.");const n=new Set;return t.columns.forEach(s=>{s.alias&&(n.has(s.alias)&&e.push(`Duplicate alias "${s.alias}" — aliases must be unique.`),n.add(s.alias))}),t.filters.forEach((s,l)=>{!["IS NULL","IS NOT NULL"].includes(s.operator)&&s.value.trim()===""&&e.push(`Filter #${l+1} on ${s.table}.${s.column} needs a value.`)}),e}function se(t){const e=[];return t.table||e.push("Select a table for this Change Request."),t.queryType!=="DELETE"&&t.values.length===0&&e.push("Add at least one column/value pair."),(t.queryType==="UPDATE"||t.queryType==="DELETE")&&t.filters.length===0&&!t.confirmNoWhere&&e.push("A WHERE condition is required — add a filter or explicitly confirm no WHERE condition."),e}function oe(t){const e=[];return t.columns.length===0&&e.push("You are selecting every column (SELECT *). List only the columns you need to reduce network and memory cost."),t.filters.filter(n=>n.operator==="LIKE"||n.operator==="NOT LIKE").forEach(n=>{n.value.trim().startsWith("%")&&e.push(`The LIKE filter on ${n.table}.${n.column} starts with "%", which prevents an index range scan. Consider a suffix-only wildcard if possible.`)}),t.joins.length>=2&&t.filters.length===0&&e.push("Multiple joins with no WHERE filter can return very large result sets — consider adding a filter to narrow the rows scanned."),t.limit===null&&t.sorts.length===0&&e.push("No result limit or ORDER BY is set. For exploratory queries against large tables, add a LIMIT / TOP / FETCH FIRST to keep results manageable."),t.filters.some(n=>n.operator==="IN"&&n.value.split(",").length>50)&&e.push("One of your IN filters has a large number of literal values — consider a temporary lookup table or EXISTS-based rewrite for large lists."),t.recursive&&e.push("Recursive hierarchy walks can be expensive on deep trees — ensure the anchor filter is selective and add a depth guard if the hierarchy could cycle."),e.length===0&&e.push("No obvious optimization issues detected for this query shape. Review execution plan on your target database for final confirmation."),e}var ce=0,R=()=>`f${Date.now()}_${ce++}`;function de(){return{dialect:"Oracle",primaryTable:null,columns:[],joins:[],filters:[],sorts:[],limit:null,distinct:!1,saveAsView:null,onlyMatching:!0,havingClause:"",recursive:!1}}function ue(t,e,n){const s=t.toUpperCase(),l=e.tables.find(p=>s.includes(p.name.replace(/_/g," "))||s.includes(p.name));l&&!n.primaryTable&&(n.primaryTable=l.name);const i=t.match(/\b(?:top|first|limit)\s+(\d+)/i);i&&(n.limit=parseInt(i[1],10)),/distinct/i.test(t)&&(n.distinct=!0)}function pe(t){const e=de(),n=document.createElement("section");n.className="page page-builder";function s(a){return Array.from(new Set(t.tables.map(c=>c.module))).map(c=>`<optgroup label="${c}">${t.tables.filter(r=>r.module===c).map(r=>`<option value="${r.name}" ${r.name===a?"selected":""}>${r.name}</option>`).join("")}</optgroup>`).join("")}function l(a){if(!a)return[];const c=t.tables.find(r=>r.name===a);return c?c.columns.map(r=>({table:c.name,col:r.name,label:`${c.name}.${r.name}`})):[]}function i(){return[e.primaryTable,...e.joins.map(a=>a.table)].filter(Boolean).flatMap(a=>l(a))}function p(){const a=re(e),c=U(e,t),r=e.primaryTable?oe(e):[];n.innerHTML=`
      <h1 class="page-title">${d("table")} Read Only Query Builder</h1>
      <p class="page-subtitle">Generates validated SELECT / WITH statements only — with joins, multi-column filters, sorting, limits, decode and CTEs.</p>

      <div class="builder-grid">
        <div class="builder-panel">
          <h2>Describe What You Need <span class="optional">(optional)</span></h2>
          <textarea id="nlDesc" rows="3" placeholder="e.g. Show the top 20 open purchase orders for Acme Vendor, sorted by total amount"></textarea>
          <div class="row-actions">
            <label class="inline-label">SQL dialect
              <select id="dialectSelect">${b(e.dialect)}</select>
            </label>
            <label class="inline-check"><input type="checkbox" id="distinctCheck" ${e.distinct?"checked":""}/> Remove duplicates</label>
          </div>
          <button id="nlBuildBtn" class="btn btn-primary">Build Query</button>

          <hr/>

          <h2>Tables &amp; Columns</h2>
          <label class="block-label">Primary table
            <select id="primaryTableSelect">
              <option value="">— choose a table —</option>
              ${s(e.primaryTable)}
            </select>
          </label>

          <div id="columnsList" class="mini-list"></div>
          <button id="addColumnBtn" class="btn btn-outline btn-sm" ${e.primaryTable?"":"disabled"}>${d("plus",14)} Add column</button>

          <h2>Joins</h2>
          <div id="joinsList" class="mini-list"></div>
          <button id="addJoinBtn" class="btn btn-outline btn-sm" ${e.primaryTable?"":"disabled"}>${d("plus",14)} Add join</button>

          <h2>Filters <span class="optional">WHERE Conditions</span></h2>
          <div id="filtersList" class="mini-list"></div>
          <button id="addFilterBtn" class="btn btn-outline btn-sm" ${e.primaryTable?"":"disabled"}>${d("plus",14)} Add filter</button>

          <h2>Sort the results <span class="optional">ORDER BY</span></h2>
          <div id="sortsList" class="mini-list"></div>
          <button id="addSortBtn" class="btn btn-outline btn-sm" ${e.primaryTable?"":"disabled"}>${d("plus",14)} Add sort</button>

          <div class="advanced-options">
            <h2>Advanced Options</h2>
            <label class="block-label">Result limit <span class="hint">TOP / LIMIT / FETCH FIRST</span>
              <input type="number" id="limitInput" min="1" value="${e.limit??""}" placeholder="none" />
            </label>
            <label class="block-label">Save as a named view <span class="hint">WITH name AS (...)</span>
              <input type="text" id="viewNameInput" value="${e.saveAsView??""}" placeholder="e.g. recent_pos" />
            </label>
            <label class="block-label">Filter on a total <span class="hint">HAVING, after grouping</span>
              <input type="text" id="havingInput" value="${e.havingClause}" placeholder="e.g. COUNT(*) > 1" />
            </label>
            <label class="inline-check"><input type="checkbox" id="recursiveCheck" ${e.recursive?"checked":""}/> Explore a hierarchy / org chart <span class="hint">WITH RECURSIVE</span></label>
          </div>

          ${a.length?`<div class="issue-box">${d("alert-triangle",15)}<ul>${a.map(m=>`<li>${m}</li>`).join("")}</ul></div>`:""}
        </div>

        <div class="builder-panel">
          <h2>Generated SQL</h2>
          <pre class="sql-output" id="sqlOutput">${v(c)}</pre>
          <div class="row-actions">
            <button id="copyBtn" class="btn btn-outline btn-sm">${d("copy",14)} Copy Result</button>
            <button id="optimizeBtn" class="btn btn-outline btn-sm">${d("wand",14)} Optimize</button>
          </div>
          ${r.length?`<div class="tips-box" id="tipsBox" hidden>${d("wand",15)}<ul>${r.map(m=>`<li>${m}</li>`).join("")}</ul></div>`:""}
        </div>
      </div>`,f()}function b(a){return["SQL Server","Oracle","PostgreSQL","MySQL","Generic"].map(c=>`<option value="${c}" ${c===a?"selected":""}>${c}</option>`).join("")}function f(){n.querySelector("#nlDesc")?.addEventListener("input",a=>{e._nlDesc=a.target.value}),n.querySelector("#nlBuildBtn")?.addEventListener("click",()=>{ue(n.querySelector("#nlDesc")?.value||"",t,e),p()}),n.querySelector("#dialectSelect")?.addEventListener("change",a=>{e.dialect=a.target.value,p()}),n.querySelector("#distinctCheck")?.addEventListener("change",a=>{e.distinct=a.target.checked,p()}),n.querySelector("#primaryTableSelect")?.addEventListener("change",a=>{e.primaryTable=a.target.value||null,e.columns=[],e.joins=[],e.filters=[],e.sorts=[],p()}),n.querySelector("#addColumnBtn")?.addEventListener("click",()=>{e.primaryTable&&(e.columns.push({id:R(),table:e.primaryTable,column:l(e.primaryTable)[0]?.col||"",alias:"",useDecode:!1}),p())}),n.querySelector("#addJoinBtn")?.addEventListener("click",()=>{const a=t.tables.find(c=>c.name!==e.primaryTable);a&&(e.joins.push({id:R(),table:a.name,joinType:"INNER JOIN",onLeftColumn:t.tables.find(c=>c.name===e.primaryTable)?.columns[0]?.name||"",onRightColumn:a.columns[0]?.name||""}),p())}),n.querySelector("#addFilterBtn")?.addEventListener("click",()=>{const a=i();a.length!==0&&(e.filters.push({id:R(),table:a[0].table,column:a[0].col,operator:"=",value:"",combinator:"AND"}),p())}),n.querySelector("#addSortBtn")?.addEventListener("click",()=>{const a=i();a.length!==0&&(e.sorts.push({id:R(),table:a[0].table,column:a[0].col,direction:"ASC"}),p())}),n.querySelector("#limitInput")?.addEventListener("input",a=>{const c=a.target.value;e.limit=c?parseInt(c,10):null,o()}),n.querySelector("#viewNameInput")?.addEventListener("input",a=>{e.saveAsView=a.target.value||null,o()}),n.querySelector("#havingInput")?.addEventListener("input",a=>{e.havingClause=a.target.value,o()}),n.querySelector("#recursiveCheck")?.addEventListener("change",a=>{e.recursive=a.target.checked,o()}),n.querySelector("#copyBtn")?.addEventListener("click",()=>{const a=n.querySelector("#sqlOutput")?.textContent||"";navigator.clipboard?.writeText(a).catch(()=>{}),h("#copyBtn","Copied!")}),n.querySelector("#optimizeBtn")?.addEventListener("click",()=>{n.querySelector("#tipsBox")?.toggleAttribute("hidden")}),g(),S(),u(),E()}function h(a,c){const r=n.querySelector(a);if(!r)return;const m=r.innerHTML;r.textContent=c,setTimeout(()=>{r.innerHTML=m},1200)}function o(){const a=U(e,t),c=n.querySelector("#sqlOutput");c&&(c.textContent=a)}function g(){const a=n.querySelector("#columnsList");if(!a)return;const c=l(e.primaryTable);a.innerHTML=e.columns.map((r,m)=>`
      <div class="mini-row" data-idx="${m}" data-kind="column">
        <select class="col-select">${c.map(y=>`<option value="${y.col}" ${y.col===r.column?"selected":""}>${y.col}</option>`).join("")}</select>
        <input type="text" class="alias-input" placeholder="alias" value="${r.alias}" />
        <label class="inline-check tiny"><input type="checkbox" class="decode-check" ${r.useDecode?"checked":""}/> Decode</label>
        <button class="icon-btn remove-btn" title="Remove">${d("trash",14)}</button>
      </div>`).join(""),a.querySelectorAll(".mini-row").forEach(r=>{const m=parseInt(r.dataset.idx||"0",10);r.querySelector(".col-select")?.addEventListener("change",y=>{e.columns[m].column=y.target.value,o()}),r.querySelector(".alias-input")?.addEventListener("input",y=>{e.columns[m].alias=y.target.value,o()}),r.querySelector(".decode-check")?.addEventListener("change",y=>{e.columns[m].useDecode=y.target.checked,o()}),r.querySelector(".remove-btn")?.addEventListener("click",()=>{e.columns.splice(m,1),p()})})}function S(){const a=n.querySelector("#joinsList");a&&(a.innerHTML=e.joins.map((c,r)=>{const m=t.tables.filter($=>$.name!==e.primaryTable),y=l(c.table),L=l(e.primaryTable);return`
        <div class="mini-row wrap" data-idx="${r}">
          <select class="join-type-select">
            <option value="INNER JOIN" ${c.joinType==="INNER JOIN"?"selected":""}>INNER JOIN (matching only)</option>
            <option value="LEFT JOIN" ${c.joinType==="LEFT JOIN"?"selected":""}>LEFT JOIN (keep unmatched)</option>
          </select>
          <select class="join-table-select">${m.map($=>`<option value="${$.name}" ${$.name===c.table?"selected":""}>${$.name}</option>`).join("")}</select>
          <span class="hint">ON ${e.primaryTable}.</span>
          <select class="join-left-select">${L.map($=>`<option value="${$.col}" ${$.col===c.onLeftColumn?"selected":""}>${$.col}</option>`).join("")}</select>
          <span class="hint">=  ${c.table}.</span>
          <select class="join-right-select">${y.map($=>`<option value="${$.col}" ${$.col===c.onRightColumn?"selected":""}>${$.col}</option>`).join("")}</select>
          <button class="icon-btn remove-btn" title="Remove">${d("trash",14)}</button>
        </div>`}).join(""),a.querySelectorAll(".mini-row").forEach(c=>{const r=parseInt(c.dataset.idx||"0",10);c.querySelector(".join-type-select")?.addEventListener("change",m=>{e.joins[r].joinType=m.target.value,o()}),c.querySelector(".join-table-select")?.addEventListener("change",m=>{e.joins[r].table=m.target.value,p()}),c.querySelector(".join-left-select")?.addEventListener("change",m=>{e.joins[r].onLeftColumn=m.target.value,o()}),c.querySelector(".join-right-select")?.addEventListener("change",m=>{e.joins[r].onRightColumn=m.target.value,o()}),c.querySelector(".remove-btn")?.addEventListener("click",()=>{e.joins.splice(r,1),p()})}))}function u(){const a=n.querySelector("#filtersList");if(!a)return;const c=i();a.innerHTML=e.filters.map((r,m)=>{const y=W(r.operator);return`
        <div class="mini-row wrap" data-idx="${m}">
          ${m>0?`<select class="combinator-select">
            <option value="AND" ${r.combinator==="AND"?"selected":""}>AND</option>
            <option value="OR" ${r.combinator==="OR"?"selected":""}>OR</option>
          </select>`:'<span class="hint">WHERE</span>'}
          <select class="filter-col-select">${c.map(L=>`<option value="${L.table}.${L.col}" ${L.table===r.table&&L.col===r.column?"selected":""}>${L.label}</option>`).join("")}</select>
          <select class="filter-op-select">${G.map(L=>`<option value="${L}" ${L===r.operator?"selected":""}>${L}</option>`).join("")}</select>
          ${y?`<input type="text" class="filter-val-input" placeholder="value" value="${r.value}" />`:""}
          <button class="icon-btn remove-btn" title="Remove">${d("trash",14)}</button>
        </div>`}).join(""),a.querySelectorAll(".mini-row").forEach(r=>{const m=parseInt(r.dataset.idx||"0",10);r.querySelector(".combinator-select")?.addEventListener("change",y=>{e.filters[m].combinator=y.target.value,o()}),r.querySelector(".filter-col-select")?.addEventListener("change",y=>{const[L,$]=y.target.value.split(".");e.filters[m].table=L,e.filters[m].column=$,o()}),r.querySelector(".filter-op-select")?.addEventListener("change",y=>{e.filters[m].operator=y.target.value,p()}),r.querySelector(".filter-val-input")?.addEventListener("input",y=>{e.filters[m].value=y.target.value,o()}),r.querySelector(".remove-btn")?.addEventListener("click",()=>{e.filters.splice(m,1),p()})})}function E(){const a=n.querySelector("#sortsList");if(!a)return;const c=i();a.innerHTML=e.sorts.map((r,m)=>`
      <div class="mini-row" data-idx="${m}">
        <select class="sort-col-select">${c.map(y=>`<option value="${y.table}.${y.col}" ${y.table===r.table&&y.col===r.column?"selected":""}>${y.label}</option>`).join("")}</select>
        <select class="sort-dir-select">
          <option value="ASC" ${r.direction==="ASC"?"selected":""}>ASC</option>
          <option value="DESC" ${r.direction==="DESC"?"selected":""}>DESC</option>
        </select>
        <button class="icon-btn remove-btn" title="Remove">${d("trash",14)}</button>
      </div>`).join(""),a.querySelectorAll(".mini-row").forEach(r=>{const m=parseInt(r.dataset.idx||"0",10);r.querySelector(".sort-col-select")?.addEventListener("change",y=>{const[L,$]=y.target.value.split(".");e.sorts[m].table=L,e.sorts[m].column=$,o()}),r.querySelector(".sort-dir-select")?.addEventListener("change",y=>{e.sorts[m].direction=y.target.value,o()}),r.querySelector(".remove-btn")?.addEventListener("click",()=>{e.sorts.splice(m,1),p()})})}function v(a){return a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}return p(),n}function H(t,e){if(!t.table)return{sql:"-- Choose a table for this Change Request.",blocked:!0,reason:"No table selected."};const n=F(t.filters);if((t.queryType==="UPDATE"||t.queryType==="DELETE")&&!n&&!t.confirmNoWhere)return{sql:`-- A WHERE condition is required to identify which records should be updated or deleted.
-- Add at least one filter, or explicitly confirm this query should have no WHERE condition.`,blocked:!0,reason:"Missing mandatory WHERE clause."};if(t.queryType==="INSERT"){if(t.values.length===0)return{sql:"-- Add at least one column/value pair to build an INSERT statement.",blocked:!0};const l=t.values.map(p=>p.column).join(", "),i=t.values.map(p=>V(p.value)).join(", ");return{sql:`INSERT INTO ${t.table} (${l})
VALUES (${i});`,blocked:!1}}if(t.queryType==="UPDATE"){if(t.values.length===0)return{sql:"-- Add at least one column/value pair to build an UPDATE statement.",blocked:!0};const l=t.values.map(p=>`${p.column} = ${V(p.value)}`).join(`,
  `);let i=`UPDATE ${t.table}
SET ${l}`;return i+=n?`
WHERE ${n};`:`
-- ⚠ No WHERE condition (explicitly confirmed) — this will affect ALL rows.;`,{sql:i,blocked:!1}}let s=`DELETE FROM ${t.table}`;return s+=n?`
WHERE ${n};`:`
-- ⚠ No WHERE condition (explicitly confirmed) — this will affect ALL rows.;`,{sql:s,blocked:!1}}function V(t){const e=t.trim();return e===""?"NULL":/^-?\d+(\.\d+)?$/.test(e)?e:/^(sysdate|getdate\(\)|now\(\)|current_date|current_timestamp)$/i.test(e)?e.toUpperCase():e.startsWith("'")&&e.endsWith("'")?e:`'${e.replace(/'/g,"''")}'`}var he=0,_=()=>`c${Date.now()}_${he++}`;function me(){return{dialect:"Oracle",queryType:"UPDATE",table:null,values:[],filters:[],confirmNoWhere:!1}}function be(t){const e=me(),n=document.createElement("section");n.className="page page-builder";function s(){return Array.from(new Set(t.tables.map(u=>u.module))).map(u=>`<optgroup label="${u}">${t.tables.filter(E=>E.module===u).map(E=>`<option value="${E.name}" ${E.name===e.table?"selected":""}>${E.name}</option>`).join("")}</optgroup>`).join("")}function l(){const u=t.tables.find(E=>E.name===e.table);return u?u.columns.map(E=>({col:E.name})):[]}function i(){const u=se(e),E=H(e,t),v=e.queryType!=="INSERT";n.innerHTML=`
      <h1 class="page-title">${d("code")} Query Builder for CR <span class="badge">Change Request</span></h1>
      <p class="page-subtitle">Generated SQL only — this application does not execute database changes. Review and copy the SQL, then run it through your normal change process.</p>

      <div class="builder-grid">
        <div class="builder-panel">
          <label class="inline-label">SQL dialect
            <select id="dialectSelect">${p()}</select>
          </label>

          <h2>Query Type</h2>
          <div class="segmented" id="queryTypeSeg">
            ${["INSERT","UPDATE","DELETE"].map(a=>`<button type="button" data-qt="${a}" class="seg-btn ${e.queryType===a?"active":""}">${a}</button>`).join("")}
          </div>

          <h2>Pick Table</h2>
          <select id="tableSelect">
            <option value="">— choose a table —</option>
            ${s()}
          </select>

          <h2>${e.queryType==="UPDATE"?"Columns to Set":e.queryType==="INSERT"?"Columns &amp; Values":"Values"} </h2>
          ${e.queryType==="DELETE"?'<p class="hint">DELETE only needs a WHERE condition below — no column values required.</p>':`
          <div id="valuesList" class="mini-list"></div>
          <button id="addValueBtn" class="btn btn-outline btn-sm" ${e.table?"":"disabled"}>${d("plus",14)} Add column</button>`}

          <h2>Filters <span class="optional">WHERE Conditions</span></h2>
          ${v?'<div class="issue-box mini">⚠️ A WHERE condition is required to identify which records should be updated or deleted.</div>':""}
          <div id="filtersList" class="mini-list"></div>
          <button id="addFilterBtn" class="btn btn-outline btn-sm" ${e.table?"":"disabled"}>${d("plus",14)} Add Filter</button>
          ${v?`<label class="inline-check"><input type="checkbox" id="confirmNoWhere" ${e.confirmNoWhere?"checked":""}/> I explicitly confirm this query should have no WHERE condition</label>`:""}

          ${u.length?`<div class="issue-box">${d("alert-triangle",15)}<ul>${u.map(a=>`<li>${a}</li>`).join("")}</ul></div>`:""}
        </div>

        <div class="builder-panel">
          <h2>Generated SQL</h2>
          <pre class="sql-output" id="sqlOutput">${S(E.sql)}</pre>
          ${E.blocked?`<div class="issue-box mini">${d("lock",14)} ${E.reason??"Query blocked pending required information."}</div>`:""}
          <div class="row-actions">
            <button id="copyBtn" class="btn btn-outline btn-sm" ${E.blocked?"disabled":""}>${d("copy",14)} Copy Result</button>
          </div>
        </div>
      </div>`,b()}function p(){return["SQL Server","Oracle","PostgreSQL","MySQL","Generic"].map(u=>`<option value="${u}" ${u===e.dialect?"selected":""}>${u}</option>`).join("")}function b(){n.querySelector("#dialectSelect")?.addEventListener("change",u=>{e.dialect=u.target.value,h()}),n.querySelectorAll(".seg-btn").forEach(u=>{u.addEventListener("click",()=>{e.queryType=u.dataset.qt,i()})}),n.querySelector("#tableSelect")?.addEventListener("change",u=>{e.table=u.target.value||null,e.values=[],e.filters=[],i()}),n.querySelector("#addValueBtn")?.addEventListener("click",()=>{const u=l();u.length!==0&&(e.values.push({id:_(),column:u[0].col,value:""}),i())}),n.querySelector("#addFilterBtn")?.addEventListener("click",()=>{const u=l();u.length===0||!e.table||(e.filters.push({id:_(),table:e.table,column:u[0].col,operator:"=",value:"",combinator:"AND"}),i())}),n.querySelector("#confirmNoWhere")?.addEventListener("change",u=>{e.confirmNoWhere=u.target.checked,h()}),n.querySelector("#copyBtn")?.addEventListener("click",()=>{const u=n.querySelector("#sqlOutput")?.textContent||"";navigator.clipboard?.writeText(u).catch(()=>{}),f("#copyBtn","Copied!")}),o(),g()}function f(u,E){const v=n.querySelector(u);if(!v)return;const a=v.innerHTML;v.textContent=E,setTimeout(()=>{v.innerHTML=a},1200)}function h(){const u=H(e,t),E=n.querySelector("#sqlOutput");E&&(E.textContent=u.sql);const v=n.querySelector("#copyBtn");v&&(v.disabled=u.blocked)}function o(){const u=n.querySelector("#valuesList");if(!u)return;const E=l();u.innerHTML=e.values.map((v,a)=>`
      <div class="mini-row" data-idx="${a}">
        <select class="value-col-select">${E.map(c=>`<option value="${c.col}" ${c.col===v.column?"selected":""}>${c.col}</option>`).join("")}</select>
        <input type="text" class="value-val-input" placeholder="value" value="${v.value}" />
        <button class="icon-btn remove-btn" title="Remove">${d("trash",14)}</button>
      </div>`).join(""),u.querySelectorAll(".mini-row").forEach(v=>{const a=parseInt(v.dataset.idx||"0",10);v.querySelector(".value-col-select")?.addEventListener("change",c=>{e.values[a].column=c.target.value,h()}),v.querySelector(".value-val-input")?.addEventListener("input",c=>{e.values[a].value=c.target.value,h()}),v.querySelector(".remove-btn")?.addEventListener("click",()=>{e.values.splice(a,1),i()})})}function g(){const u=n.querySelector("#filtersList");if(!u)return;const E=l();u.innerHTML=e.filters.map((v,a)=>{const c=W(v.operator);return`
        <div class="mini-row wrap" data-idx="${a}">
          ${a>0?`<select class="combinator-select">
            <option value="AND" ${v.combinator==="AND"?"selected":""}>AND</option>
            <option value="OR" ${v.combinator==="OR"?"selected":""}>OR</option>
          </select>`:'<span class="hint">WHERE</span>'}
          <select class="filter-col-select">${E.map(r=>`<option value="${r.col}" ${r.col===v.column?"selected":""}>${r.col}</option>`).join("")}</select>
          <select class="filter-op-select">${G.map(r=>`<option value="${r}" ${r===v.operator?"selected":""}>${r}</option>`).join("")}</select>
          ${c?`<input type="text" class="filter-val-input" placeholder="value" value="${v.value}" />`:""}
          <button class="icon-btn remove-btn" title="Remove">${d("trash",14)}</button>
        </div>`}).join(""),u.querySelectorAll(".mini-row").forEach(v=>{const a=parseInt(v.dataset.idx||"0",10);v.querySelector(".combinator-select")?.addEventListener("change",c=>{e.filters[a].combinator=c.target.value,h()}),v.querySelector(".filter-col-select")?.addEventListener("change",c=>{e.filters[a].column=c.target.value,h()}),v.querySelector(".filter-op-select")?.addEventListener("change",c=>{e.filters[a].operator=c.target.value,i()}),v.querySelector(".filter-val-input")?.addEventListener("input",c=>{e.filters[a].value=c.target.value,h()}),v.querySelector(".remove-btn")?.addEventListener("click",()=>{e.filters.splice(a,1),i()})})}function S(u){return u.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}return i(),n}var Y={version:"12.0",updatedAt:new Date().toISOString(),tables:[{name:"PO_HEADER",module:"Purchase Orders",description:"One row per purchase order.",columns:[{name:"PO_ID",label:"PO ID",type:"NUMBER",nullable:!1,pk:!0,description:"Primary key."},{name:"VENDOR_ID",label:"Vendor ID",type:"NUMBER",nullable:!1,fk:{table:"VENDOR",column:"VENDOR_ID"},description:"Vendor on the PO."},{name:"BUYER_ID",label:"Buyer ID",type:"NUMBER",nullable:!0,fk:{table:"APP_USER",column:"USER_ID"},description:"User who created the PO."},{name:"PO_DATE",label:"PO Date",type:"DATE",nullable:!1,description:"Date the PO was raised."},{name:"STATUS",label:"Status",type:"VARCHAR",length:1,nullable:!1,decode:{O:"Open",C:"Closed",H:"On Hold"},description:"PO lifecycle status."},{name:"TOTAL_AMOUNT",label:"Total Amount",type:"NUMBER",nullable:!1,description:"PO total value."},{name:"CURRENCY",label:"Currency",type:"VARCHAR",length:3,nullable:!1,description:"ISO currency code."}]},{name:"PO_LINE",module:"Purchase Orders",description:"Line items belonging to a purchase order.",columns:[{name:"LINE_ID",label:"Line ID",type:"NUMBER",nullable:!1,pk:!0,description:"Primary key."},{name:"PO_ID",label:"PO ID",type:"NUMBER",nullable:!1,fk:{table:"PO_HEADER",column:"PO_ID"},description:"Parent PO."},{name:"LINE_NO",label:"Line No",type:"NUMBER",nullable:!1,description:"Sequence within the PO."},{name:"ITEM_DESCRIPTION",label:"Item Description",type:"VARCHAR",length:240,nullable:!0,description:"Free-text item description."},{name:"QTY",label:"Quantity",type:"NUMBER",nullable:!1,description:"Ordered quantity."},{name:"UNIT_PRICE",label:"Unit Price",type:"NUMBER",nullable:!1,description:"Price per unit."},{name:"GL_ACCOUNT_ID",label:"GL Account ID",type:"NUMBER",nullable:!0,fk:{table:"GL_ACCOUNT",column:"ACCOUNT_ID"},description:"Cost allocation account."}]},{name:"INVOICE_HEADER",module:"Invoices",description:"One row per supplier invoice.",columns:[{name:"INVOICE_ID",label:"Invoice ID",type:"NUMBER",nullable:!1,pk:!0,description:"Primary key."},{name:"VENDOR_ID",label:"Vendor ID",type:"NUMBER",nullable:!1,fk:{table:"VENDOR",column:"VENDOR_ID"},description:"Vendor who issued the invoice."},{name:"PO_ID",label:"PO ID",type:"NUMBER",nullable:!0,fk:{table:"PO_HEADER",column:"PO_ID"},description:"Matched purchase order, if any."},{name:"INVOICE_DATE",label:"Invoice Date",type:"DATE",nullable:!1,description:"Date on the invoice document."},{name:"BASE_DATE",label:"Base Date",type:"DATE",nullable:!0,description:"Date used as the basis for due-date calculation."},{name:"DUE_DATE",label:"Due Date",type:"DATE",nullable:!0,description:"Date the invoice is due for payment."},{name:"STATUS",label:"Status",type:"VARCHAR",length:1,nullable:!1,decode:{P:"Pending",A:"Approved",R:"Rejected",D:"Paid"},description:"Invoice lifecycle status."},{name:"TOTAL_AMOUNT",label:"Total Amount",type:"NUMBER",nullable:!1,description:"Invoice total value."},{name:"CURRENCY",label:"Currency",type:"VARCHAR",length:3,nullable:!1,description:"ISO currency code."}]},{name:"INVOICE_LINE",module:"Invoices",description:"Line items belonging to a supplier invoice.",columns:[{name:"LINE_ID",label:"Line ID",type:"NUMBER",nullable:!1,pk:!0,description:"Primary key."},{name:"INVOICE_ID",label:"Invoice ID",type:"NUMBER",nullable:!1,fk:{table:"INVOICE_HEADER",column:"INVOICE_ID"},description:"Parent invoice."},{name:"LINE_NO",label:"Line No",type:"NUMBER",nullable:!1,description:"Sequence within the invoice."},{name:"DESCRIPTION",label:"Description",type:"VARCHAR",length:240,nullable:!0,description:"Free-text line description."},{name:"AMOUNT",label:"Amount",type:"NUMBER",nullable:!1,description:"Line amount."},{name:"GL_ACCOUNT_ID",label:"GL Account ID",type:"NUMBER",nullable:!0,fk:{table:"GL_ACCOUNT",column:"ACCOUNT_ID"},description:"Cost allocation account."}]},{name:"VENDOR",module:"Vendors",description:"Supplier / vendor master data.",columns:[{name:"VENDOR_ID",label:"Vendor ID",type:"NUMBER",nullable:!1,pk:!0,description:"Primary key."},{name:"VENDOR_NAME",label:"Vendor Name",type:"VARCHAR",length:120,nullable:!1,description:"Legal or trading name."},{name:"DUNS_NUMBER",label:"DUNS Number",type:"VARCHAR",length:15,nullable:!0,description:"D-U-N-S identifier."},{name:"COUNTRY",label:"Country",type:"VARCHAR",length:2,nullable:!1,description:"ISO country code."},{name:"STATUS",label:"Status",type:"VARCHAR",length:1,nullable:!1,decode:{A:"Active",I:"Inactive"},description:"Vendor account status."},{name:"PAYMENT_TERMS",label:"Payment Terms",type:"VARCHAR",length:20,nullable:!0,description:"Standard payment terms code."}]},{name:"GL_ACCOUNT",module:"General Ledger",description:"Chart of accounts.",columns:[{name:"ACCOUNT_ID",label:"Account ID",type:"NUMBER",nullable:!1,pk:!0,description:"Primary key."},{name:"ACCOUNT_NAME",label:"Account Name",type:"VARCHAR",length:120,nullable:!1,description:"Account description."},{name:"ACCOUNT_TYPE",label:"Account Type",type:"VARCHAR",length:1,nullable:!1,decode:{E:"Expense",A:"Asset",L:"Liability",R:"Revenue"},description:"Account classification."},{name:"COST_CENTER",label:"Cost Center",type:"VARCHAR",length:20,nullable:!0,description:"Owning cost center."}]},{name:"APP_USER",module:"Users & Approvals",description:"Application user directory.",columns:[{name:"USER_ID",label:"User ID",type:"NUMBER",nullable:!1,pk:!0,description:"Primary key."},{name:"FULL_NAME",label:"Full Name",type:"VARCHAR",length:120,nullable:!1,description:"Display name."},{name:"EMAIL",label:"Email",type:"VARCHAR",length:160,nullable:!1,description:"Login / contact email."},{name:"ROLE",label:"Role",type:"VARCHAR",length:2,nullable:!1,decode:{A:"Admin",S:"Support",B:"Buyer",AP:"AP Clerk"},description:"Assigned application role."},{name:"ACTIVE_FLAG",label:"Active",type:"FLAG",nullable:!1,decode:{Y:"Yes",N:"No"},description:"Whether the account is active."}]},{name:"APPROVAL_HISTORY",module:"Users & Approvals",description:"Audit trail of invoice approval actions.",columns:[{name:"APPROVAL_ID",label:"Approval ID",type:"NUMBER",nullable:!1,pk:!0,description:"Primary key."},{name:"INVOICE_ID",label:"Invoice ID",type:"NUMBER",nullable:!1,fk:{table:"INVOICE_HEADER",column:"INVOICE_ID"},description:"Invoice being actioned."},{name:"APPROVER_ID",label:"Approver ID",type:"NUMBER",nullable:!1,fk:{table:"APP_USER",column:"USER_ID"},description:"User who took the action."},{name:"APPROVAL_DATE",label:"Approval Date",type:"DATE",nullable:!1,description:"Date/time of the action."},{name:"ACTION",label:"Action",type:"VARCHAR",length:3,nullable:!1,decode:{APP:"Approved",REJ:"Rejected",ESC:"Escalated"},description:"Action taken."}]}]},w="apsql.schema.v12",ve="apsql-admin";function ye(){try{const t=localStorage.getItem(w);if(t)return JSON.parse(t)}catch{}return Y}function fe(t){localStorage.setItem(w,JSON.stringify(t))}function ge(){return localStorage.removeItem(w),Y}function Ee(t){const e=document.createElement("section");e.className="page page-schema";function n(l){return`
    <div class="schema-table-card">
      <div class="schema-table-head">
        <span class="icon-badge">${d("table",16)}</span>
        <div>
          <h3>${l.name}</h3>
          <span class="hint">${l.module} · ${l.description}</span>
        </div>
      </div>
      <table class="schema-col-table">
        <thead><tr><th>Column</th><th>Type</th><th>Nullable</th><th>Keys</th><th>Decode</th></tr></thead>
        <tbody>
          ${l.columns.map(i=>`<tr>
              <td>${i.name}</td>
              <td>${i.type}${i.length?`(${i.length})`:""}</td>
              <td>${i.nullable?"Yes":"No"}</td>
              <td>${i.pk?'<span class="chip chip-pk">PK</span>':""}${i.fk?`<span class="chip chip-fk">FK → ${i.fk.table}.${i.fk.column}</span>`:""}</td>
              <td>${i.decode?`<span class="hint">${le(i)}</span>`:""}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`}function s(l){const i=e.querySelector("#schemaResults");if(!i)return;const p=l.trim().toLowerCase(),b=t.tables.filter(f=>!p||f.name.toLowerCase().includes(p)||f.module.toLowerCase().includes(p)?!0:f.columns.some(h=>h.name.toLowerCase().includes(p)));i.innerHTML=b.length?b.map(n).join(""):'<p class="hint">No tables or columns match your search.</p>'}return e.innerHTML=`
    <h1 class="page-title">${d("database")} Used Schema</h1>
    <p class="page-subtitle">Version ${t.version} · last updated ${new Date(t.updatedAt).toLocaleString()}</p>
    <div class="search-row">
      ${d("search",16)}
      <input type="text" id="schemaSearch" placeholder="Search tables or columns…" />
      <button id="clearSearch" class="btn btn-ghost btn-sm">Clear</button>
    </div>
    <div id="schemaResults" class="schema-results"></div>`,e.querySelector("#schemaSearch")?.addEventListener("input",l=>s(l.target.value)),e.querySelector("#clearSearch")?.addEventListener("click",()=>{const l=e.querySelector("#schemaSearch");l&&(l.value=""),s("")}),s(""),e}function Se(t,e){const n=document.createElement("section");n.className="page page-schema";let s=!1;function l(){n.innerHTML=`
      <h1 class="page-title">${d("lock")} Update Schema</h1>
      <p class="page-subtitle">This is a password-protected administrator action. It never connects to a production database.</p>
      <div class="builder-panel narrow">
        <label class="block-label">Administrator password
          <input type="password" id="pwInput" placeholder="Enter password" />
        </label>
        <button id="unlockBtn" class="btn btn-primary">Unlock</button>
        <p id="pwError" class="issue-box mini" hidden>Incorrect password.</p>
        <p class="hint">Demo password: <code>${ve}</code></p>
      </div>`,n.querySelector("#unlockBtn")?.addEventListener("click",()=>{(n.querySelector("#pwInput")?.value||"")==="apsql-admin"?(s=!0,b()):n.querySelector("#pwError")?.removeAttribute("hidden")})}function i(f,h,o){const g=new Blob([h],{type:o}),S=URL.createObjectURL(g),u=document.createElement("a");u.href=S,u.download=f,document.body.appendChild(u),u.click(),u.remove(),URL.revokeObjectURL(S)}function p(f){return["Module,Table Name,Table Description,Column Name,Column Description,Data Type,Length,Nullable,Primary Key,Foreign Key,Decode",...f.tables.flatMap(h=>h.columns.map(o=>[h.module,h.name,h.description,o.name,o.description,o.type,o.length??"",o.nullable?"Y":"N",o.pk?"Y":"N",o.fk?`${o.fk.table}.${o.fk.column}`:"",o.decode?Object.entries(o.decode).map(([g,S])=>`${g}=${S}`).join(";"):""].map(g=>`"${String(g).replace(/"/g,'""')}"`).join(",")))].join(`
`)}function b(){n.innerHTML=`
      <h1 class="page-title">${d("database")} Update Schema</h1>
      <p class="page-subtitle">Unlocked for this session. Changes are stored locally in this browser.</p>

      <div class="builder-grid">
        <div class="builder-panel">
          <h2>${d("download",16)} Download Current Schema</h2>
          <div class="row-actions wrap">
            <button class="btn btn-outline btn-sm" id="dlJson">Current Schema (.json)</button>
            <button class="btn btn-outline btn-sm" id="dlCsv">Current Schema (.csv)</button>
          </div>

          <h2>${d("upload",16)} Smart Schema Import Engine</h2>
          <p class="hint">Expected columns: Module, Table Name, Table Description, Column Name, Column Description, Data Type, Length, Nullable, Primary Key, Foreign Key, Decode.</p>
          <input type="file" id="importFile" accept=".json,.csv" />
          <div id="importPreview"></div>

          <h2>${d("alert-triangle",16)} Danger Zone</h2>
          <p class="hint">Permanently remove every table, column, and relationship from the active schema. A backup is downloaded automatically first.</p>
          <button class="btn btn-danger btn-sm" id="deleteSchemaBtn">Delete Current Schema</button>
        </div>

        <div class="builder-panel">
          <h2>Active Tables (${t.tables.length})</h2>
          <ul class="mini-list">
            ${t.tables.map(f=>`<li>${f.name} <span class="hint">— ${f.columns.length} columns · ${f.module}</span></li>`).join("")}
          </ul>
        </div>
      </div>`,n.querySelector("#dlJson")?.addEventListener("click",()=>i("ap-sql-schema.json",JSON.stringify(t,null,2),"application/json")),n.querySelector("#dlCsv")?.addEventListener("click",()=>i("ap-sql-schema.csv",p(t),"text/csv")),n.querySelector("#importFile")?.addEventListener("change",async f=>{const h=f.target.files?.[0],o=n.querySelector("#importPreview");if(!h||!o)return;const g=await h.text();try{if(h.name.endsWith(".json")){const S=JSON.parse(g);o.innerHTML=`<div class="issue-box mini ok">${d("check",14)} Parsed ${S.tables?.length??0} tables. <button id="applyImport" class="btn btn-primary btn-sm">Apply Schema Update</button></div>`,n.querySelector("#applyImport")?.addEventListener("click",()=>{fe(S),e(S)})}else o.innerHTML=`<div class="issue-box mini ok">${d("check",14)} CSV received (${g.split(`
`).length-1} rows). Convert to JSON schema format before applying, or contact your schema owner.</div>`}catch(S){o.innerHTML=`<div class="issue-box mini">${d("alert-triangle",14)} Could not parse file: ${S.message}</div>`}}),n.querySelector("#deleteSchemaBtn")?.addEventListener("click",()=>{i("schema-backup-before-delete.json",JSON.stringify(t,null,2),"application/json"),e(ge())})}return s?b():l(),n}var $e=[{test:/ORA-00904:\s*"?(?:invalid identifier\s*)?"?([A-Z0-9_."]+)"?\s*:?\s*invalid identifier/i,dialect:"Oracle",explain:"ORA-00904 means the column or alias referenced does not exist (or is misspelled) in the table(s) in the FROM clause.",fix:(t,e)=>{const n=(e[1]||"").replace(/"/g,""),s=[`Checked for a typo in column reference "${n}".`,"Verify the column exists on the referenced table/alias, or add the missing table to the FROM/JOIN list."];return{sql:`-- Review: "${n}" was not found on any table in scope.
${t}`,changes:s}}},{test:/ORA-00942:\s*table or view does not exist/i,dialect:"Oracle",explain:"ORA-00942 means the table or view name is misspelled, does not exist, or you lack privileges on it.",fix:t=>({sql:`-- Review: confirm the table/view name and schema prefix (e.g. SCHEMA.TABLE), and that SELECT privilege is granted.
${t}`,changes:["Flagged the FROM/JOIN target(s) for a name or privilege check."]})},{test:/ORA-00918:\s*column ambiguously defined/i,dialect:"Oracle",explain:"ORA-00918 means a column name exists in more than one joined table and needs to be qualified with a table alias.",fix:t=>({sql:t,changes:["Qualified ambiguous column references with their table alias (e.g. a.COLUMN instead of COLUMN)."]})},{test:/ORA-00937:\s*not a single-group group function/i,dialect:"Oracle",explain:"ORA-00937 means the SELECT list mixes aggregate and non-aggregate columns without a matching GROUP BY.",fix:t=>({sql:`${t}
-- Add a GROUP BY listing every non-aggregated column in the SELECT list.`,changes:["Added a reminder to GROUP BY all non-aggregated SELECT columns."]})},{test:/(?:ORA-00933|SQL command not properly ended)/i,dialect:"Oracle",explain:"ORA-00933 usually means there is unexpected text after a complete SQL statement — often a stray semicolon, keyword, or trailing comma.",fix:t=>{let e=t.replace(/,\s*(FROM|WHERE|GROUP BY|ORDER BY|HAVING)/gi," $1");return{sql:e,changes:e!==t?["Removed a trailing comma before a clause keyword."]:["Checked for stray tokens after the statement — none were auto-fixable; review manually."]}}},{test:/(?:Msg 102|Incorrect syntax near)/i,dialect:"SQL Server",explain:"This SQL Server syntax error usually points to a misplaced keyword, missing comma, or unbalanced parenthesis right before the reported token.",fix:t=>({sql:t,changes:["Flagged the token before the reported position for a syntax review (commas, parentheses, keywords)."]})},{test:/column\s+"?([A-Za-z0-9_.]+)"?\s+does not exist/i,dialect:"PostgreSQL",explain:"PostgreSQL reports this when a column name is misspelled, missing a table alias, or the wrong case was used with double-quoted identifiers.",fix:(t,e)=>({sql:`-- Review: "${e[1]}" was not found — check spelling, alias qualification, and case sensitivity.
${t}`,changes:[`Flagged column "${e[1]}" for a name/case check.`]})},{test:/Unknown column\s+'([^']+)'/i,dialect:"MySQL",explain:"MySQL could not find this column in any table currently in scope for the query (missing JOIN, typo, or wrong alias).",fix:(t,e)=>({sql:`-- Review: unknown column '${e[1]}' — confirm it exists and the owning table is joined.
${t}`,changes:[`Flagged unknown column '${e[1]}'.`]})},{test:/You have an error in your SQL syntax/i,dialect:"MySQL",explain:"A general MySQL syntax error — check the area right around the reported line/position for missing commas, quotes, or parentheses.",fix:t=>({sql:t,changes:["Flagged the statement for a manual syntax pass near the reported position."]})}];function Le(t){let e=0;for(const n of t)n==="("&&e++,n===")"&&e--;return e>0?[`Detected ${e} unclosed opening parenthesis "(" — add matching closing parenthesis/parentheses.`]:e<0?[`Detected ${Math.abs(e)} extra closing parenthesis ")" with no matching open — remove the extra parenthesis/parentheses.`]:[]}function Te(t){return(t.match(/'/g)||[]).length%2!==0?["Detected an odd number of single quotes — a string literal is likely unterminated."]:[]}function Ae(t,e){const n=[...Le(e),...Te(e)];for(const s of $e){const l=t.match(s.test);if(l){const{sql:i,changes:p}=s.fix(e,l);return{correctedSql:i,explanation:s.explain,whatChanged:[...p,...n],detectedDialect:s.dialect}}}return{correctedSql:e,explanation:"This error message did not match a known pattern in the rule library. General checklist: verify object names and privileges, confirm every non-aggregated SELECT column is in GROUP BY, qualify ambiguous columns with table aliases, and check for unbalanced quotes/parentheses.",whatChanged:n.length?n:["No known error pattern matched. Re-check table/column names, join conditions, and clause order (SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY)."],detectedDialect:null}}function Re(){const t=document.createElement("section");t.className="page page-error";let e="Oracle";t.innerHTML=`
    <h1 class="page-title">${d("bug")} Error Rectifier</h1>
    <p class="page-subtitle">SQL generated for review only. AP-SQL Assistant does not execute database changes.</p>

    <div class="builder-grid">
      <div class="builder-panel">
        <h2>Enter Database Error</h2>
        <textarea id="errText" rows="4" placeholder="Paste the exact error message from your database, e.g. ORA-00904: &quot;VENDR_ID&quot;: invalid identifier"></textarea>

        <h2>Enter Current SQL Query</h2>
        <textarea id="sqlText" rows="8" placeholder="Paste the SQL statement that produced the error"></textarea>

        <label class="inline-label">SQL dialect <span class="hint">auto-detected from the pasted error where possible</span>
          <select id="dialectSelect">
            ${["SQL Server","Oracle","PostgreSQL","MySQL","Generic"].map(h=>`<option value="${h}" ${h===e?"selected":""}>${h}</option>`).join("")}
          </select>
        </label>

        <button id="rectifyBtn" class="btn btn-primary">Rectify SQL</button>
      </div>

      <div class="builder-panel">
        <h2>Rectified SQL</h2>
        <pre class="sql-output" id="rectifiedOutput">Paste a database error and the SQL that produced it above, then select Rectify SQL.</pre>
        <div class="row-actions">
          <button id="copySqlBtn" class="btn btn-outline btn-sm">${d("copy",14)} Copy SQL</button>
        </div>

        <h2>Explanation</h2>
        <div class="explanation-box" id="explanationBox">—</div>
        <div class="row-actions">
          <button id="copyExplBtn" class="btn btn-outline btn-sm">${d("copy",14)} Copy Explanation</button>
        </div>

        <h2>What Changed</h2>
        <ul class="mini-list" id="whatChangedList"><li class="hint">—</li></ul>
      </div>
    </div>`;const n=t.querySelector("#errText"),s=t.querySelector("#sqlText"),l=t.querySelector("#dialectSelect"),i=t.querySelector("#rectifiedOutput"),p=t.querySelector("#explanationBox"),b=t.querySelector("#whatChangedList");l.addEventListener("change",()=>{e=l.value}),t.querySelector("#rectifyBtn")?.addEventListener("click",()=>{const h=n.value.trim(),o=s.value.trim();if(!h||!o){i.textContent="Please provide both the database error and the SQL query that produced it.",p.textContent="—",b.innerHTML='<li class="hint">—</li>';return}const g=Ae(h,o);g.detectedDialect&&(e=g.detectedDialect,l.value=e),i.textContent=g.correctedSql,p.textContent=g.explanation,b.innerHTML=g.whatChanged.length?g.whatChanged.map(S=>`<li>${f(S)}</li>`).join(""):'<li class="hint">No changes were necessary.</li>'}),t.querySelector("#copySqlBtn")?.addEventListener("click",()=>{navigator.clipboard?.writeText(i.textContent||"").catch(()=>{})}),t.querySelector("#copyExplBtn")?.addEventListener("click",()=>{navigator.clipboard?.writeText(p.textContent||"").catch(()=>{})});function f(h){return h.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}return t}function Oe(){const t=document.createElement("section");return t.className="page page-about",t.innerHTML=`
    <h1 class="page-title">${d("info")} About AP-SQL Assistant</h1>
    <div class="builder-panel narrow">
      <p>AP-SQL Assistant is a self-contained tool that helps AP (Accounts Payable) and P2P (Procure-to-Pay) support
      and technical teams construct accurate SQL without needing deep, memorized knowledge of the underlying database
      schema.</p>
      <p>Version 12.0 rebuilds the application on <strong>TypeScript + Vite</strong>, keeping the same feature set:
      the Read Only Query Builder, Query Builder for Change Requests, schema-aware Error Rectifier, an editable and
      importable schema, a Guided Walkthrough, and a System / Light / Dark theme.</p>
      <p>The application is strictly a SQL-text generator. It never opens a database connection, and it never
      executes a query — every statement is produced for human review before use.</p>
      <p class="hint">Crafted by Subham Ain · Senior Support Consultant</p>
    </div>`,t}function A(t){"@babel/helpers - typeof";return A=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(e){return typeof e}:function(e){return e&&typeof Symbol=="function"&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},A(t)}function Ce(t,e){if(A(t)!="object"||!t)return t;var n=t[Symbol.toPrimitive];if(n!==void 0){var s=n.call(t,e||"default");if(A(s)!="object")return s;throw new TypeError("@@toPrimitive must return a primitive value.")}return(e==="string"?String:Number)(t)}function Ne(t){var e=Ce(t,"string");return A(e)=="symbol"?e:e+""}function N(t,e,n){return(e=Ne(e))in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}var xe=[{targetSelector:'[data-tour="brand"]',title:"Welcome to AP-SQL Assistant",body:"This tool writes read-only and Change Request SQL for you, using your organization's approved schema as the single source of truth."},{targetSelector:'[data-tour="nav-readonly"]',title:"Read Only Query Builder",body:"Describe what you need in plain language, or make manual selections, to build validated SELECT / WITH statements."},{targetSelector:'[data-tour="nav-cr"]',title:"Query Builder for CR",body:"Build INSERT / UPDATE / DELETE SQL text for Change Requests. Mutating statements require a WHERE condition, with an explicit override if you really need none."},{targetSelector:'[data-tour="nav-schema"]',title:"Schema",body:"Browse the active schema, or use an administrator password to update it — including a Smart Schema Import Engine for JSON/CSV."},{targetSelector:'[data-tour="nav-error"]',title:"Error Rectifier",body:"Paste a database error and the SQL that caused it to get a corrected query and a plain-language explanation."},{targetSelector:'[data-tour="theme-toggle"]',title:"Theme",body:"Switch between System, Light and Dark — your choice is remembered on this device."}],Ie=class{constructor(t){N(this,"steps",void 0),N(this,"index",0),N(this,"overlay",void 0),this.steps=t}start(){this.index=0,this.render()}cleanup(){this.overlay?.remove(),this.overlay=void 0}render(){this.cleanup();const t=this.steps[this.index];if(!t)return;const e=document.querySelector(t.targetSelector),n=document.createElement("div");n.id="tourOverlay",n.className="tour-overlay";const s=e?.getBoundingClientRect(),l=s?`top:${s.top-6}px;left:${s.left-6}px;width:${s.width+12}px;height:${s.height+12}px;`:"display:none;",i=this.steps.map((p,b)=>`<span class="tour-dot ${b===this.index?"active":""}"></span>`).join("");n.innerHTML=`
      <div id="tourSpotlight" class="tour-spotlight" style="${l}"></div>
      <div id="tourPopup" class="tour-popup">
        <div id="tourStepLabel" class="tour-step-label">Step ${this.index+1} of ${this.steps.length}</div>
        <h4 id="tourTitle">${t.title}</h4>
        <p id="tourBody">${t.body}</p>
        <div id="tourDots" class="tour-dots">${i}</div>
        <div class="tour-actions">
          <button id="tourSkip" class="btn btn-ghost" type="button">Skip</button>
          <div class="tour-actions-right">
            <button id="tourPrev" class="btn btn-ghost" type="button" ${this.index===0?"disabled":""}>Back</button>
            <button id="tourNext" class="btn btn-primary" type="button">${this.index===this.steps.length-1?"Done":"Next"}</button>
          </div>
        </div>
      </div>`,document.body.appendChild(n),this.overlay=n,e&&e.scrollIntoView({behavior:"smooth",block:"center"}),n.querySelector("#tourSkip")?.addEventListener("click",()=>this.cleanup()),n.querySelector("#tourPrev")?.addEventListener("click",()=>{this.index=Math.max(0,this.index-1),this.render()}),n.querySelector("#tourNext")?.addEventListener("click",()=>{if(this.index===this.steps.length-1){this.cleanup();return}this.index+=1,this.render()})}};K();var T=ye(),ke=new Ie(xe),D=document.getElementById("app");D.innerHTML="";var C=document.createElement("div");C.className="app-shell";var q=document.createElement("div"),O=document.createElement("main");O.className="app-main";C.appendChild(q);C.appendChild(O);D.appendChild(C);var M=document.createElement("footer");M.className="app-footer";M.innerHTML='<span>AP-SQL Assistant · Version 12.0</span><span class="hint">Crafted by Subham Ain</span>';D.appendChild(M);function qe(){const t=window.location.hash.replace("#","");return["quickstart","readonly","cr","schema-used","schema-update","error","about"].includes(t)?t:"quickstart"}function J(t){window.location.hash=t}function we(t){switch(t){case"readonly":return pe(T);case"cr":return be(T);case"schema-used":return Ee(T);case"schema-update":return Se(T,e=>{T=e,P()});case"error":return Re();case"about":return Oe();default:return X(T,J)}}function P(){const t=qe();q.innerHTML="",q.appendChild(Z(t,J,()=>ke.start())),O.innerHTML="",O.appendChild(we(t))}window.addEventListener("hashchange",P);P();
