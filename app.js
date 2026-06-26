const accountMeta = [
  { key: "isa", label: "ISA", color: "#16806f" },
  { key: "pension", label: "연금저축", color: "#b67818" },
  { key: "irp", label: "IRP", color: "#d19a3a" },
  { key: "dc", label: "DC형", color: "#386fae" },
  { key: "domestic", label: "국내직투", color: "#7f8b86" },
  { key: "foreign", label: "해외직투", color: "#c43b52" },
];

const state = {
  experience: "beginner",
  goal: "cash",
  age: 35,
  annualAmount: 1200,
  targetAmount: 10000,
  incomeBand: "standard",
  overseas: "medium",
  returnRate: 5,
};

const slideIds = ["opening", "account-map", "simulator", "takeaway"];
let activeSlideIndex = 0;

const formatWon = (won) => {
  const value = Math.round(won / 10000);
  if (value >= 10000) {
    const eok = value / 10000;
    return `${eok.toLocaleString("ko-KR", { maximumFractionDigits: eok >= 10 ? 0 : 1 })}억원`;
  }
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}만원`;
};

const formatManwon = (manwon) => {
  if (manwon >= 10000) {
    const eok = manwon / 10000;
    return `${eok.toLocaleString("ko-KR", { maximumFractionDigits: eok >= 10 ? 0 : 1 })}억원`;
  }
  return `${manwon.toLocaleString("ko-KR")}만원`;
};

const normalizeAllocation = (raw) => {
  const safe = Object.fromEntries(
    accountMeta.map(({ key }) => [key, Math.max(0, raw[key] ?? 0)]),
  );
  const total = Object.values(safe).reduce((sum, value) => sum + value, 0) || 1;
  return Object.fromEntries(
    Object.entries(safe).map(([key, value]) => [key, Math.round((value / total) * 100)]),
  );
};

const fixRoundedTotal = (allocation) => {
  const entries = accountMeta.map(({ key }) => [key, allocation[key]]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const diff = 100 - total;
  if (diff === 0) return allocation;
  const largest = entries.reduce((best, item) => (item[1] > best[1] ? item : best), entries[0]);
  return { ...allocation, [largest[0]]: largest[1] + diff };
};

const buildAllocation = () => {
  const raw = {
    isa: 35,
    pension: 18,
    irp: 8,
    dc: 8,
    domestic: 21,
    foreign: 10,
  };

  if (state.goal === "tax") {
    raw.pension += 18;
    raw.irp += 16;
    raw.isa -= 8;
    raw.domestic -= 12;
  }
  if (state.goal === "retirement") {
    raw.pension += 18;
    raw.irp += 14;
    raw.dc += 12;
    raw.domestic -= 11;
    raw.foreign -= 7;
  }
  if (state.goal === "cash") {
    raw.isa += 18;
    raw.domestic += 8;
    raw.irp -= 9;
    raw.pension -= 7;
  }

  if (state.experience === "beginner") {
    raw.isa += 8;
    raw.domestic += 5;
    raw.foreign -= 7;
    raw.irp -= 3;
  } else {
    raw.foreign += 6;
    raw.isa += 4;
  }

  if (state.overseas === "low") {
    raw.foreign -= 10;
    raw.isa += 7;
    raw.domestic += 3;
  }
  if (state.overseas === "high") {
    raw.foreign += 18;
    raw.domestic -= 6;
    raw.dc -= 3;
  }

  if (state.age >= 50) {
    raw.pension += 6;
    raw.irp += 6;
    raw.dc += 4;
    raw.foreign -= 6;
  }
  if (state.age <= 30 && state.goal !== "retirement") {
    raw.isa += 6;
    raw.foreign += state.overseas === "high" ? 4 : 1;
    raw.irp -= 3;
  }

  if (state.targetAmount > state.annualAmount * 10 && state.goal === "cash") {
    raw.isa += 6;
    raw.domestic += 5;
    raw.pension -= 5;
  }

  return fixRoundedTotal(normalizeAllocation(raw));
};

const calculateScenario = () => {
  const allocation = buildAllocation();
  const annualWon = state.annualAmount * 10000;
  const rate = state.returnRate / 100;
  const amounts = Object.fromEntries(
    accountMeta.map(({ key }) => [key, annualWon * (allocation[key] / 100)]),
  );

  const pensionEligible = Math.min(amounts.pension, 6_000_000);
  const irpEligible = Math.min(amounts.irp, Math.max(0, 9_000_000 - pensionEligible));
  const creditRate = state.incomeBand === "low" ? 0.165 : 0.132;
  const pensionTaxCredit = (pensionEligible + irpEligible) * creditRate;

  const isaThreeYearGain = amounts.isa * rate * 3;
  const isaExemption = state.incomeBand === "low" ? 4_000_000 : 2_000_000;
  const regularIsaTax = isaThreeYearGain * 0.154;
  const isaTax = Math.max(0, isaThreeYearGain - isaExemption) * 0.099;
  const isaTaxSaving = Math.max(0, regularIsaTax - isaTax) / 3;

  const foreignGain = amounts.foreign * rate;
  const foreignTax = Math.max(0, foreignGain - 2_500_000) * 0.22;
  const annualTaxValue = pensionTaxCredit + isaTaxSaving;
  const annuityFactor = rate > 0 ? ((1 + rate) ** 10 - 1) / rate : 10;
  const compoundValue = annualTaxValue * annuityFactor;
  const defenseScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        50 +
          allocation.isa * 0.22 +
          (allocation.pension + allocation.irp) * 0.28 +
          allocation.dc * 0.08 -
          allocation.foreign * 0.22 +
          (annualTaxValue / Math.max(annualWon, 1)) * 180,
      ),
    ),
  );

  return {
    allocation,
    amounts,
    pensionTaxCredit,
    isaTaxSaving,
    foreignTax,
    annualTaxValue,
    compoundValue,
    defenseScore,
  };
};

const adviceFor = (scenario) => {
  if (state.goal === "tax") {
    return {
      line: "연말정산 방어가 목적이면 연금저축 600만원과 IRP 보강 한도를 먼저 확인하세요.",
      items: [
        `세액공제 예상치는 ${formatWon(scenario.pensionTaxCredit)}입니다.`,
        "중도 인출 제약이 큰 돈은 IRP보다 ISA나 일반 계좌에 남겨 둡니다.",
        "연금 계좌는 절세가 강하지만 유동성 비용도 같이 관리해야 합니다.",
      ],
    };
  }

  if (state.goal === "retirement") {
    return {
      line: "장기 노후 준비라면 연금저축·IRP·DC형을 한 묶음으로 보고 과세이연 시간을 확보하세요.",
      items: [
        "노후 목적 자금은 세액공제와 과세이연이 동시에 작동하는 계좌를 우선합니다.",
        `현재 조합은 연 ${formatWon(scenario.annualTaxValue)} 정도를 다시 굴릴 여지를 만듭니다.`,
        "위험자산 비중은 나이보다 은퇴까지 남은 기간과 현금흐름으로 조정합니다.",
      ],
    };
  }

  if (state.overseas === "high") {
    return {
      line: "미국 직투 비중이 높다면 수익률만큼이나 실현이익 250만원 초과 구간을 관리해야 합니다.",
      items: [
        `해외직투 세금 노출 추정치는 연 ${formatWon(scenario.foreignTax)}입니다.`,
        "해외 ETF 대체 노출은 ISA나 연금 계좌 안의 국내 상장 ETF와 비교합니다.",
        "실현 시점, 손실 통산, 환율을 같이 관리해야 세후 수익률이 흔들리지 않습니다.",
      ],
    };
  }

  return {
    line: "3년 안에 쓸 목돈은 ISA를 중심으로 두고, 연금 계좌는 오래 묶어도 되는 금액만 넣으세요.",
    items: [
      `추천 조합에서 ISA 비중은 ${scenario.allocation.isa}%입니다.`,
      `10년 재투자 가치 추정치는 ${formatWon(scenario.compoundValue)}입니다.`,
      "목돈 계좌와 노후 계좌를 분리하면 수익률보다 중요한 출금 타이밍을 지킬 수 있습니다.",
    ],
  };
};

const updateLabels = () => {
  document.querySelector("#ageLabel").textContent = `${state.age}세`;
  document.querySelector("#amountLabel").textContent = formatManwon(state.annualAmount);
  document.querySelector("#targetLabel").textContent = formatManwon(state.targetAmount);
  document.querySelector("#returnLabel").textContent = `연 ${state.returnRate.toFixed(1)}%`;
};

const renderAllocationBars = (allocation) => {
  const container = document.querySelector("#allocationBars");
  container.innerHTML = accountMeta
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
};

const renderDonut = (allocation) => {
  let cursor = 0;
  const stops = accountMeta
    .map(({ key, color }) => {
      const start = cursor;
      cursor += allocation[key] * 3.6;
      return `${color} ${start.toFixed(1)}deg ${cursor.toFixed(1)}deg`;
    })
    .join(", ");
  document.querySelector("#allocationDonut").style.background = `conic-gradient(${stops})`;
};

const renderScenario = () => {
  updateLabels();
  const scenario = calculateScenario();
  const advice = adviceFor(scenario);

  document.querySelector("#taxSavingMetric").textContent = formatWon(scenario.annualTaxValue);
  document.querySelector("#compoundMetric").textContent = formatWon(scenario.compoundValue);
  document.querySelector("#foreignTaxMetric").textContent = formatWon(scenario.foreignTax);
  document.querySelector("#heroBenefit").textContent = formatWon(scenario.compoundValue);
  document.querySelector("#defenseScore").textContent = String(scenario.defenseScore);
  document.querySelector("#scoreLabel").textContent =
    scenario.defenseScore >= 75 ? "절세 우선 조합" : scenario.defenseScore >= 58 ? "균형 조합" : "공격형 조합";
  document.querySelector("#savingBarLabel").textContent = formatWon(scenario.annualTaxValue);
  document.querySelector("#oneLineAdvice").textContent = advice.line;
  document.querySelector("#actionItems").innerHTML = advice.items.map((item) => `<li>${item}</li>`).join("");

  const regularTaxLoad = Math.max(scenario.annualTaxValue + scenario.foreignTax, 1);
  const optimizedRetained = Math.max(scenario.annualTaxValue, 1);
  const maxBar = Math.max(regularTaxLoad, optimizedRetained);
  document.querySelector("#taxableBar").style.width = `${Math.max(10, (regularTaxLoad / maxBar) * 100)}%`;
  document.querySelector("#optimizedBar").style.width = `${Math.max(10, (optimizedRetained / maxBar) * 100)}%`;

  renderAllocationBars(scenario.allocation);
  renderDonut(scenario.allocation);
};

const setSegmented = (button) => {
  const field = button.dataset.field;
  const value = button.dataset.value;
  if (!field || !value) return;
  state[field] = value;
  document
    .querySelectorAll(`button[data-field="${field}"]`)
    .forEach((item) => item.classList.toggle("active", item === button));
  renderScenario();
};

const bindControls = () => {
  document.querySelectorAll(".segmented button").forEach((button) => {
    button.addEventListener("click", () => setSegmented(button));
  });

  ["goal", "incomeBand"].forEach((id) => {
    const element = document.querySelector(`#${id}`);
    element.addEventListener("change", () => {
      state[id] = element.value;
      renderScenario();
    });
  });

  ["age", "annualAmount", "targetAmount", "returnRate"].forEach((id) => {
    const element = document.querySelector(`#${id}`);
    element.addEventListener("input", () => {
      state[id] = Number(element.value);
      renderScenario();
    });
  });
};

const goToSlide = (index) => {
  activeSlideIndex = Math.max(0, Math.min(slideIds.length - 1, index));
  const id = slideIds[activeSlideIndex];
  document.querySelector(`#${id}`).scrollIntoView({ behavior: "smooth", block: "start" });
  updateNav();
};

const updateNav = () => {
  const id = slideIds[activeSlideIndex];
  document.querySelectorAll(".deck-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.target === id);
  });
  document.querySelector("#slideCounter").textContent = `${activeSlideIndex + 1} / ${slideIds.length}`;
};

const bindDeck = () => {
  document.querySelectorAll(".deck-nav button").forEach((button) => {
    button.addEventListener("click", () => {
      const index = slideIds.indexOf(button.dataset.target);
      if (index >= 0) goToSlide(index);
    });
  });

  document.querySelector("#prevSlide").addEventListener("click", () => goToSlide(activeSlideIndex - 1));
  document.querySelector("#nextSlide").addEventListener("click", () => goToSlide(activeSlideIndex + 1));

  document.addEventListener("keydown", (event) => {
    const targetName = event.target?.tagName;
    if (["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(targetName)) return;
    if (event.key === "ArrowRight" || event.key === "PageDown") goToSlide(activeSlideIndex + 1);
    if (event.key === "ArrowLeft" || event.key === "PageUp") goToSlide(activeSlideIndex - 1);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (!visible) return;
      activeSlideIndex = slideIds.indexOf(visible.target.id);
      updateNav();
    },
    { threshold: [0.45, 0.7] },
  );

  document.querySelectorAll("[data-slide]").forEach((slide) => observer.observe(slide));
};

bindControls();
bindDeck();
renderScenario();
