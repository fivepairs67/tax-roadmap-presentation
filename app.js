const accounts = [
  { key: "isa", label: "ISA", color: "#39d795" },
  { key: "pension", label: "연금저축", color: "#ffc267" },
  { key: "irp", label: "IRP", color: "#f59e59" },
  { key: "dc", label: "DC형", color: "#7095ff" },
  { key: "domestic", label: "국내직투", color: "#8792a8" },
  { key: "foreign", label: "해외직투", color: "#ff7b78" },
];

const personaDefaults = {
  starter: { age: 35, annualAmount: 1800, foreignGain: 600, dividendIncome: 300, incomeBand: "standard", horizon: 10 },
  taxShield: { age: 42, annualAmount: 2400, foreignGain: 300, dividendIncome: 400, incomeBand: "low", horizon: 12 },
  global: { age: 38, annualAmount: 3200, foreignGain: 2200, dividendIncome: 500, incomeBand: "standard", horizon: 10 },
  retirement: { age: 50, annualAmount: 2800, foreignGain: 400, dividendIncome: 600, incomeBand: "standard", horizon: 18 },
};

const state = { persona: "starter", ...personaDefaults.starter };
const sceneIds = ["hero", "map", "research", "simulator", "playbook"];
let activeScene = 0;
let heroFrame = 0;

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];

const formatManwon = (value) => {
  const rounded = Math.round(value);
  if (rounded >= 10000) {
    const eok = rounded / 10000;
    return `${eok.toLocaleString("ko-KR", { maximumFractionDigits: eok >= 10 ? 0 : 1 })}억원`;
  }
  return `${rounded.toLocaleString("ko-KR")}만원`;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function normalizeAllocation(raw) {
  const safe = Object.fromEntries(accounts.map(({ key }) => [key, Math.max(0, raw[key] ?? 0)]));
  const total = Object.values(safe).reduce((sum, value) => sum + value, 0) || 1;
  const normalized = Object.fromEntries(Object.entries(safe).map(([key, value]) => [key, Math.round((value / total) * 100)]));
  const diff = 100 - Object.values(normalized).reduce((sum, value) => sum + value, 0);
  const largest = accounts.map(({ key }) => key).sort((a, b) => normalized[b] - normalized[a])[0];
  normalized[largest] += diff;
  return normalized;
}

function buildAllocation() {
  const raw = {
    isa: 30,
    pension: 16,
    irp: 8,
    dc: 8,
    domestic: 24,
    foreign: 14,
  };

  if (state.persona === "starter") {
    raw.isa += 18;
    raw.domestic += 8;
    raw.irp -= 7;
    raw.foreign -= 6;
  }

  if (state.persona === "taxShield") {
    raw.pension += 20;
    raw.irp += 14;
    raw.isa -= 6;
    raw.domestic -= 12;
    raw.foreign -= 5;
  }

  if (state.persona === "global") {
    raw.foreign += 22;
    raw.isa += 8;
    raw.domestic -= 12;
    raw.dc -= 4;
  }

  if (state.persona === "retirement") {
    raw.pension += 16;
    raw.irp += 12;
    raw.dc += 14;
    raw.foreign -= 10;
    raw.domestic -= 8;
  }

  if (state.age >= 50) {
    raw.pension += 6;
    raw.irp += 5;
    raw.dc += 5;
    raw.foreign -= 6;
  }

  if (state.foreignGain > 1500) {
    raw.foreign -= 6;
    raw.isa += 4;
    raw.domestic += 2;
  }

  if (state.annualAmount < 1200) {
    raw.isa += 10;
    raw.pension -= 4;
    raw.irp -= 4;
  }

  if (state.horizon >= 15) {
    raw.pension += 6;
    raw.dc += 4;
    raw.domestic -= 5;
  }

  return normalizeAllocation(raw);
}

function calculate() {
  const allocation = buildAllocation();
  const annual = state.annualAmount;
  const expectedReturn = 0.055;

  const amountByAccount = Object.fromEntries(accounts.map(({ key }) => [key, annual * (allocation[key] / 100)]));
  const pensionEligible = Math.min(amountByAccount.pension, 600);
  const irpEligible = Math.min(amountByAccount.irp, Math.max(0, 900 - pensionEligible));
  const creditRate = state.incomeBand === "low" ? 0.165 : 0.132;
  const pensionCredit = (pensionEligible + irpEligible) * creditRate;

  const isaGain = amountByAccount.isa * expectedReturn * 3;
  const isaExemption = state.incomeBand === "low" ? 400 : 200;
  const regularIsaTax = isaGain * 0.154;
  const isaTax = Math.max(0, isaGain - isaExemption) * 0.099;
  const isaSaving = Math.max(0, regularIsaTax - isaTax) / 3;

  const foreignTax = Math.max(0, state.foreignGain - 250) * 0.22;
  const foreignManagementSaving = foreignTax * Math.min(0.7, allocation.isa / 100 + allocation.domestic / 220);
  const dividendTax = state.dividendIncome * 0.154;
  const dividendDeferral = dividendTax * ((allocation.isa + allocation.pension + allocation.irp + allocation.dc) / 100) * 0.35;

  const annualDefense = pensionCredit + isaSaving + foreignManagementSaving + dividendDeferral;
  const rate = expectedReturn;
  const factor = ((1 + rate) ** state.horizon - 1) / rate;
  const compound = annualDefense * factor;
  const regularWealth = annual * (((1 + rate * 0.82) ** state.horizon - 1) / (rate * 0.82 || 1));
  const optimizedWealth = annual * (((1 + rate) ** state.horizon - 1) / (rate || 1)) + compound;
  const gap = optimizedWealth - regularWealth;
  const score = clamp(
    Math.round(
      48 +
        allocation.isa * 0.19 +
        (allocation.pension + allocation.irp) * 0.22 +
        allocation.dc * 0.1 -
        allocation.foreign * 0.13 +
        (annualDefense / Math.max(annual, 1)) * 95,
    ),
    0,
    100,
  );

  return {
    allocation,
    amountByAccount,
    pensionCredit,
    isaSaving,
    foreignTax,
    annualDefense,
    compound,
    regularWealth,
    optimizedWealth,
    gap,
    score,
  };
}

function adviceFor(result) {
  if (state.persona === "taxShield") {
    return {
      title: "연말정산이 목표라면 연금저축 600만원 축을 먼저 채우고 IRP는 오래 묶어도 되는 돈으로 보강하세요.",
      items: [
        `세액공제 추정 기여분은 연 ${formatManwon(result.pensionCredit)}입니다.`,
        "환급액은 소비 예산이 아니라 다음 해 납입 원금으로 다시 넣어야 복리 효과가 살아납니다.",
        "3년 안에 쓸 돈은 IRP 대신 ISA나 현금성 자산으로 분리합니다.",
      ],
    };
  }

  if (state.persona === "global") {
    return {
      title: "미국 직투는 세전 수익률이 아니라 250만원 공제 이후의 세후 수익률로 판단해야 합니다.",
      items: [
        `현재 해외주식 양도세 노출 추정치는 연 ${formatManwon(result.foreignTax)}입니다.`,
        "해외 상장 ETF 직접투자와 국내 상장 해외 ETF의 세금·환율·상품비용을 같이 비교합니다.",
        "실현이익을 한 해에 몰지 말고 손실 통산과 매도 시점을 함께 계획합니다.",
      ],
    };
  }

  if (state.persona === "retirement") {
    return {
      title: "노후자금은 연금저축·IRP·DC형을 분리하지 말고 하나의 장기 포트폴리오로 봐야 합니다.",
      items: [
        `기간 누적 재투자 여력은 약 ${formatManwon(result.compound)}입니다.`,
        "DC형 퇴직연금이 원리금보장 상품에 방치되어 있는지 먼저 확인합니다.",
        "연금 수령 나이와 수령 기간을 정해야 중도해지 리스크를 줄일 수 있습니다.",
      ],
    };
  }

  return {
    title: "초보자는 세금보다 유동성이 먼저입니다. ISA를 중심으로 3년 돈의 그릇을 만들고 연금계좌는 작게 시작하세요.",
    items: [
      `추천 조합의 1순위 계좌는 ${leadAccount(result.allocation)}입니다.`,
      "목돈 계좌와 노후 계좌를 분리하면 급한 지출 때문에 장기 계좌를 깨는 일을 줄일 수 있습니다.",
      "일반 계좌는 완전히 배제하는 곳이 아니라 유동성과 개별 종목 학습을 담당하는 공간입니다.",
    ],
  };
}

function leadAccount(allocation) {
  const top = accounts.map((item) => ({ ...item, value: allocation[item.key] })).sort((a, b) => b.value - a.value)[0];
  return top.label;
}

function updateLabels() {
  qs("#ageLabel").textContent = `${state.age}세`;
  qs("#amountLabel").textContent = formatManwon(state.annualAmount);
  qs("#foreignGainLabel").textContent = formatManwon(state.foreignGain);
  qs("#dividendLabel").textContent = formatManwon(state.dividendIncome);
  qs("#horizonLabel").textContent = `${state.horizon}년`;
}

function renderAllocation(allocation) {
  let cursor = 0;
  const stops = accounts
    .map(({ key, color }) => {
      const start = cursor;
      cursor += allocation[key] * 3.6;
      return `${color} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`;
    })
    .join(", ");
  qs("#donut").style.background = `conic-gradient(${stops})`;
  qs("#leadAccount").textContent = leadAccount(allocation);
  qs("#allocationBars").innerHTML = accounts
    .map(
      ({ key, label, color }) => `
        <div class="allocation-row">
          <span>${label}</span>
          <div class="allocation-track"><i style="width: ${allocation[key]}%; background: ${color}"></i></div>
          <strong>${allocation[key]}%</strong>
        </div>
      `,
    )
    .join("");
}

function drawWealthChart(result) {
  const canvas = qs("#wealthChart");
  const context = canvas.getContext("2d");
  const pixelRatio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
  canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));
  context.scale(pixelRatio, pixelRatio);
  const width = rect.width;
  const height = rect.height;
  context.clearRect(0, 0, width, height);

  const points = Array.from({ length: state.horizon + 1 }, (_, year) => {
    const regular = state.annualAmount * year * (1 + 0.045 * year * 0.5);
    const optimized = regular + result.annualDefense * year * (1 + 0.055 * year * 0.45);
    return { year, regular, optimized };
  });
  const maxValue = Math.max(...points.map((point) => point.optimized), 1);
  const left = 42;
  const right = 18;
  const top = 18;
  const bottom = 36;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const x = (index) => left + (index / (points.length - 1 || 1)) * chartWidth;
  const y = (value) => top + chartHeight - (value / maxValue) * chartHeight;

  context.strokeStyle = "#e5e9f2";
  context.lineWidth = 1;
  context.font = "12px system-ui, sans-serif";
  context.fillStyle = "#7a8497";
  for (let i = 0; i <= 4; i += 1) {
    const yy = top + (chartHeight / 4) * i;
    context.beginPath();
    context.moveTo(left, yy);
    context.lineTo(width - right, yy);
    context.stroke();
  }

  const drawLine = (key, color, widthLine) => {
    context.beginPath();
    points.forEach((point, index) => {
      const xx = x(index);
      const yy = y(point[key]);
      if (index === 0) context.moveTo(xx, yy);
      else context.lineTo(xx, yy);
    });
    context.strokeStyle = color;
    context.lineWidth = widthLine;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
  };

  drawLine("regular", "#8792a8", 3);
  drawLine("optimized", "#20bd82", 4);

  context.fillStyle = "#111827";
  context.font = "700 12px system-ui, sans-serif";
  context.fillText("일반", width - right - 84, y(points.at(-1).regular) + 4);
  context.fillText("절세 조합", width - right - 84, y(points.at(-1).optimized) - 8);
  context.fillStyle = "#7a8497";
  context.fillText("0", left - 10, height - bottom + 18);
  context.fillText(`${state.horizon}년`, width - right - 28, height - bottom + 18);
}

function render() {
  updateLabels();
  const result = calculate();
  const advice = adviceFor(result);
  qs("#savingMetric").textContent = formatManwon(result.annualDefense);
  qs("#compoundMetric").textContent = formatManwon(result.compound);
  qs("#compoundCaption").textContent = `${state.horizon}년 복리 가정`;
  qs("#scoreMetric").textContent = String(result.score);
  qs("#scoreCaption").textContent = result.score >= 78 ? "절세 우선" : result.score >= 62 ? "균형 조합" : "공격형 조합";
  qs("#gapMetric").textContent = `차이 ${formatManwon(result.gap)}`;
  qs("#oneLineAdvice").textContent = advice.title;
  qs("#actionItems").innerHTML = advice.items.map((item) => `<li>${item}</li>`).join("");
  qs("#heroTaxDrag").textContent = `연 ${formatManwon(result.annualDefense)}`;
  qs("#heroRegular").textContent = `세후 ${formatManwon(result.regularWealth)}`;
  qs("#heroOptimized").textContent = `세후 ${formatManwon(result.optimizedWealth)}`;
  renderAllocation(result.allocation);
  drawWealthChart(result);
}

function applyPersona(persona) {
  state.persona = persona;
  Object.assign(state, personaDefaults[persona]);
  qsa(".persona-switch button").forEach((button) => button.classList.toggle("active", button.dataset.value === persona));
  ["age", "annualAmount", "foreignGain", "dividendIncome", "incomeBand", "horizon"].forEach((id) => {
    qs(`#${id}`).value = state[id];
  });
  render();
}

function bindControls() {
  qsa(".persona-switch button").forEach((button) => {
    button.addEventListener("click", () => applyPersona(button.dataset.value));
  });

  ["age", "annualAmount", "foreignGain", "dividendIncome", "horizon"].forEach((id) => {
    qs(`#${id}`).addEventListener("input", (event) => {
      state[id] = Number(event.target.value);
      render();
    });
  });

  qs("#incomeBand").addEventListener("change", (event) => {
    state.incomeBand = event.target.value;
    render();
  });
}

function goToScene(index) {
  activeScene = clamp(index, 0, sceneIds.length - 1);
  qs(`#${sceneIds[activeScene]}`).scrollIntoView({ behavior: "smooth", block: "start" });
  updateSceneUI();
}

function updateSceneUI() {
  qs("#sceneCounter").textContent = `${activeScene + 1} / ${sceneIds.length}`;
}

function bindDeck() {
  qs("#prevScene").addEventListener("click", () => goToScene(activeScene - 1));
  qs("#nextScene").addEventListener("click", () => goToScene(activeScene + 1));
  document.addEventListener("keydown", (event) => {
    const tag = event.target?.tagName;
    if (["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(tag)) return;
    if (event.key === "ArrowRight" || event.key === "PageDown") goToScene(activeScene + 1);
    if (event.key === "ArrowLeft" || event.key === "PageUp") goToScene(activeScene - 1);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      activeScene = sceneIds.indexOf(visible.target.id);
      updateSceneUI();
    },
    { threshold: [0.45, 0.72] },
  );
  qsa("[data-scene]").forEach((scene) => observer.observe(scene));

  window.addEventListener("scroll", () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    qs("#progressLine").style.width = `${maxScroll > 0 ? (window.scrollY / maxScroll) * 100 : 0}%`;
  }, { passive: true });
}

function animateHero() {
  const canvas = qs("#heroCanvas");
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  ctx.scale(ratio, ratio);
  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#080b16";
  ctx.fillRect(0, 0, width, height);

  const lanes = [
    { y: height * 0.28, color: "rgba(126,242,200,0.85)", speed: 0.8 },
    { y: height * 0.46, color: "rgba(99,216,255,0.72)", speed: 0.55 },
    { y: height * 0.64, color: "rgba(255,123,120,0.68)", speed: 0.38 },
  ];

  lanes.forEach((lane, laneIndex) => {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, lane.y);
    for (let x = 0; x <= width; x += 24) {
      ctx.lineTo(x, lane.y + Math.sin(x * 0.009 + heroFrame * 0.018 + laneIndex) * 22);
    }
    ctx.stroke();

    for (let i = 0; i < 16; i += 1) {
      const x = ((i * 160 + heroFrame * lane.speed * 2.2) % (width + 240)) - 120;
      const y = lane.y + Math.sin(x * 0.009 + heroFrame * 0.018 + laneIndex) * 22;
      ctx.fillStyle = lane.color;
      ctx.beginPath();
      ctx.arc(x, y, i % 4 === 0 ? 4.4 : 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let x = 0; x < width; x += 72) {
    ctx.fillRect(x, 0, 1, height);
  }
  for (let y = 0; y < height; y += 72) {
    ctx.fillRect(0, y, width, 1);
  }

  heroFrame += 1;
  requestAnimationFrame(animateHero);
}

window.addEventListener("resize", render);
bindControls();
bindDeck();
render();
animateHero();
