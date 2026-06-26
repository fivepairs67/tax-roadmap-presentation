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
  const allocation = result.allocation;
  const taxShelterShare = allocation.isa + allocation.pension + allocation.irp + allocation.dc;
  const pensionStack = allocation.pension + allocation.irp + allocation.dc;
  const pensionRoom = Math.max(0, 900 - Math.min(result.amountByAccount.pension, 600) - Math.min(result.amountByAccount.irp, 900));
  const foreignTaxExposure = result.foreignTax;
  const dividendTax = state.dividendIncome * 0.154;
  const lead = leadAccount(allocation);

  if (state.annualAmount <= 900) {
    return {
      title: "시드머니 단계에서는 계좌를 많이 늘리기보다 ISA 중심으로 출금 가능성을 지키는 편이 낫습니다.",
      items: [
        `연간 투자금 ${formatManwon(state.annualAmount)} 구간에서는 추천 1순위가 ${lead}입니다.`,
        `연금저축·IRP·DC형 합산 비중은 ${pensionStack}%로 낮춰, 급한 지출 때문에 장기 계좌를 깨는 일을 줄입니다.`,
        state.horizon < 7 ? "투자 기간이 짧으므로 세액공제보다 3년 전후 목돈 사용 가능성을 먼저 봅니다." : "기간이 길어질수록 연금저축을 소액 자동납입으로 붙여도 부담이 작아집니다.",
      ],
    };
  }

  if (state.horizon <= 5 && pensionStack >= 35) {
    return {
      title: "투자 기간이 짧다면 세액공제 욕심보다 묶이는 계좌 비중을 낮추는 것이 먼저입니다.",
      items: [
        `${state.horizon}년 안에 쓸 가능성이 있는 돈은 ISA와 일반 계좌에 더 많이 남겨 둡니다.`,
        `현재 장기 계좌 묶음 비중은 ${pensionStack}%입니다. 중도해지 비용을 감당할 수 있는 돈인지 확인해야 합니다.`,
        `절세 효과는 연 ${formatManwon(result.annualDefense)}으로 보이지만, 출금 타이밍을 잃으면 체감 수익률이 흔들립니다.`,
      ],
    };
  }

  if (state.foreignGain >= 2500) {
    return {
      title: "해외주식 실현이익이 큰 구간입니다. 지금은 계좌 비중보다 매도 시점과 손익통산 관리가 더 중요합니다.",
      items: [
        `해외주식 양도세 노출 추정치는 연 ${formatManwon(foreignTaxExposure)}입니다.`,
        "실현이익을 한 해에 몰지 말고 손실 종목, 환율, 매도 연도를 같이 봅니다.",
        `해외직투 비중은 ${allocation.foreign}%로 두되, 일부 글로벌 노출은 ISA·연금계좌 안의 국내 상장 해외 ETF와 비교합니다.`,
      ],
    };
  }

  if (state.dividendIncome >= 2000) {
    return {
      title: "배당·분배금 규모가 커졌습니다. 이제는 수익률보다 금융소득 과세 경계를 먼저 관리해야 합니다.",
      items: [
        `일반 계좌 배당·분배금 ${formatManwon(state.dividendIncome)}은 2,000만원 경계에 닿아 있습니다.`,
        `배당 원천세 단순 추정치는 연 ${formatManwon(dividendTax)}이고, 절세계좌 비중은 ${taxShelterShare}%입니다.`,
        "분배금이 많은 ETF는 ISA·연금계좌에 우선 배치하고, 일반 계좌에는 저분배·개별주 중심 자산을 남깁니다.",
      ],
    };
  }

  if (state.annualAmount >= 5000) {
    return {
      title: "투자금이 큰 구간에서는 절세계좌 한도를 채운 뒤 남는 돈의 세후 배치가 승부처입니다.",
      items: [
        `연간 투자금 ${formatManwon(state.annualAmount)} 중 절세계좌 추천 비중은 ${taxShelterShare}%입니다.`,
        `연금저축·IRP 세액공제 한도 여력은 약 ${formatManwon(pensionRoom)}입니다. 한도 밖 자금은 ISA와 일반 계좌 역할을 분리합니다.`,
        `기간 누적 재투자 여력은 약 ${formatManwon(result.compound)}으로 커지므로, 배당·해외 실현이익을 매년 점검해야 합니다.`,
      ],
    };
  }

  if (state.foreignGain > 250) {
    return {
      title: "해외주식 이익이 기본공제를 넘었습니다. 미국 직투는 세전 수익률이 아니라 세후 수익률로 봐야 합니다.",
      items: [
        `해외주식 양도세 노출 추정치는 연 ${formatManwon(foreignTaxExposure)}입니다.`,
        `해외직투 비중 ${allocation.foreign}%와 ISA 비중 ${allocation.isa}%를 함께 보며 글로벌 노출을 나눕니다.`,
        "실현이익이 커지는 해에는 손실 통산, 매도 분산, 국내 상장 해외 ETF 대체 가능성을 같이 검토합니다.",
      ],
    };
  }

  if (state.horizon >= 15 || state.age >= 50) {
    return {
      title: "기간이 길거나 은퇴가 가까울수록 연금저축·IRP·DC형을 하나의 노후 포트폴리오로 묶어 봐야 합니다.",
      items: [
        `장기 계좌 묶음 비중은 ${pensionStack}%이고, 기간 누적 재투자 여력은 약 ${formatManwon(result.compound)}입니다.`,
        state.age >= 50 ? "연금 수령 나이와 수령 기간을 먼저 정해야 중도해지 리스크를 줄일 수 있습니다." : "투자 기간이 길기 때문에 과세이연 효과가 짧은 목돈 전략보다 크게 작동합니다.",
        "DC형 퇴직연금이 원리금보장 상품에 방치되어 있는지 확인하고, 연금계좌 전체의 위험자산 비중을 맞춥니다.",
      ],
    };
  }

  if (state.persona === "taxShield" || result.pensionCredit >= 60) {
    return {
      title: "연말정산 효과가 의미 있는 구간입니다. 연금저축 600만원 축을 먼저 보고 IRP는 묶어도 되는 돈으로 보강하세요.",
      items: [
        `세액공제 추정 기여분은 연 ${formatManwon(result.pensionCredit)}입니다.`,
        `연간 투자금 ${formatManwon(state.annualAmount)}에서는 세액공제 한도와 ISA 납입 여력을 동시에 나눠야 합니다.`,
        "환급액은 소비 예산이 아니라 다음 해 납입 원금으로 다시 넣어야 복리 효과가 살아납니다.",
      ],
    };
  }

  return {
    title: "중간 투자금 구간에서는 ISA를 중심축으로 두고 연금저축을 보조 엔진처럼 붙이는 균형 전략이 좋습니다.",
    items: [
      `추천 1순위는 ${lead}이고, 절세계좌 합산 비중은 ${taxShelterShare}%입니다.`,
      `연간 절세/방어 가치는 약 ${formatManwon(result.annualDefense)}, ${state.horizon}년 누적 재투자 여력은 약 ${formatManwon(result.compound)}입니다.`,
      "일반 계좌는 완전히 배제하지 말고 단기 유동성, 개별 종목 학습, 세금 한도 밖 자금의 공간으로 남깁니다.",
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
