const accounts = [
  { key: "isa", label: "ISA", color: "#4d7c65" },
  { key: "pension", label: "연금저축", color: "#b9823f" },
  { key: "irp", label: "IRP", color: "#9f6f4f" },
  { key: "dc", label: "DC형", color: "#315f8c" },
  { key: "domestic", label: "국내직투", color: "#7a8594" },
  { key: "foreign", label: "해외직투", color: "#b96958" },
];

const numericFields = [
  "age",
  "annualAmount",
  "foreignGain",
  "dividendIncome",
  "totalSalary",
  "horizon",
  "expectedReturn",
  "nearTermNeed",
  "taxDue",
  "isaRoom",
  "financialIncome",
  "privatePensionIncome",
  "spouseTaxDue",
];

const TAX_PROFILE_LABELS = {
  general: "일반",
  dependent: "피부양자/피부양 예정",
  retired: "은퇴·지역가입 전환 예정",
  globalTaxed: "최근 금융소득종합과세 이력",
};

const HOUSEHOLD_MODE_LABELS = {
  individual: "개인 기준",
  couple: "부부 명의 분산",
};

const personaDefaults = {
  starter: { age: 35, annualAmount: 1800, foreignGain: 600, dividendIncome: 300, totalSalary: 6000, horizon: 10, expectedReturn: 5.5, nearTermNeed: 500, taxDue: 90, isaRoom: 2000, financialIncome: 300, privatePensionIncome: 0, spouseTaxDue: 0, taxProfile: "general", householdMode: "individual" },
  taxShield: { age: 42, annualAmount: 2400, foreignGain: 300, dividendIncome: 400, totalSalary: 5000, horizon: 12, expectedReturn: 5.5, nearTermNeed: 400, taxDue: 140, isaRoom: 2000, financialIncome: 400, privatePensionIncome: 0, spouseTaxDue: 0, taxProfile: "general", householdMode: "individual" },
  global: { age: 38, annualAmount: 3200, foreignGain: 2200, dividendIncome: 500, totalSalary: 8500, horizon: 10, expectedReturn: 6.5, nearTermNeed: 300, taxDue: 180, isaRoom: 2000, financialIncome: 800, privatePensionIncome: 0, spouseTaxDue: 0, taxProfile: "general", householdMode: "individual" },
  retirement: { age: 50, annualAmount: 2800, foreignGain: 400, dividendIncome: 600, totalSalary: 9000, horizon: 18, expectedReturn: 5, nearTermNeed: 700, taxDue: 160, isaRoom: 2000, financialIncome: 1200, privatePensionIncome: 1200, spouseTaxDue: 0, taxProfile: "retired", householdMode: "individual" },
};

const LIMITS = {
  isaAnnual: 2000,
  pensionCredit: 600,
  pensionTotalCredit: 900,
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

function normalizeUserAmountsToAnnual(amounts, annual) {
  const next = { ...amounts };
  const nonDomesticKeys = accounts.map(({ key }) => key).filter((key) => !["domestic", "dc"].includes(key));
  const nonDomesticTotal = nonDomesticKeys.reduce((sum, key) => sum + Math.max(0, next[key] ?? 0), 0);
  if (nonDomesticTotal > annual) {
    const scale = annual / nonDomesticTotal;
    nonDomesticKeys.forEach((key) => {
      next[key] = (next[key] ?? 0) * scale;
    });
    next.domestic = 0;
  } else {
    next.domestic = Math.max(0, annual - nonDomesticTotal);
  }
  return Object.fromEntries(accounts.filter(({ key }) => key !== "dc").map(({ key }) => [key, Math.max(0, next[key] ?? 0)]));
}

function salaryProfile() {
  const salary = state.totalSalary;
  if (salary <= 5000) {
    return {
      label: "ISA 서민형 · 연금 16.5%",
      isaType: "서민형",
      isaExemption: 400,
      pensionCreditRate: 0.165,
    };
  }
  if (salary <= 5500) {
    return {
      label: "ISA 일반형 · 연금 16.5%",
      isaType: "일반형",
      isaExemption: 200,
      pensionCreditRate: 0.165,
    };
  }
  if (salary <= 7000) {
    return {
      label: "ISA 일반형 · 연금 13.2%",
      isaType: "일반형",
      isaExemption: 200,
      pensionCreditRate: 0.132,
    };
  }
  if (salary <= 12000) {
    return {
      label: "고소득 일반형 · 연금 13.2%",
      isaType: "일반형",
      isaExemption: 200,
      pensionCreditRate: 0.132,
    };
  }
  return {
    label: "초고소득 일반형 · 연금 13.2%",
    isaType: "일반형",
    isaExemption: 200,
    pensionCreditRate: 0.132,
  };
}

function estimateDcContribution() {
  return state.totalSalary / 12;
}

function householdMultiplier() {
  return state.householdMode === "couple" ? 2 : 1;
}

function totalCreditTaxDue() {
  return Math.max(0, state.taxDue + (state.householdMode === "couple" ? state.spouseTaxDue : 0));
}

function estimateHealthInsuranceCost(gates) {
  if (!gates.healthSensitive || !gates.financialInsuranceWatch) return 0;
  const excess = Math.max(0, gates.insuranceIncome - 1000);
  return Math.round(120 + Math.min(120, excess * 0.12));
}

function pensionExitTaxRate(endAge, gates) {
  if (endAge < 55) return 0.165;
  if (gates.pensionIncomeWatch) return 0.165;
  if (endAge >= 80) return 0.033;
  if (endAge >= 70) return 0.044;
  return 0.055;
}

function estimatePensionExitTax(amountByAccount, years, rate, gates) {
  if (years <= 0) return 0;
  const pensionAnnual = Math.max(0, (amountByAccount.pension ?? 0) + (amountByAccount.irp ?? 0));
  if (pensionAnnual <= 0) return 0;
  const taxableBalance = pensionAnnual * futureValueFactor(rate, years);
  return taxableBalance * pensionExitTaxRate(state.age + years, gates);
}

function riskSettings(profile = salaryProfile()) {
  const nearTermNeed = clamp(state.nearTermNeed, 0, state.annualAmount);
  const lockableAnnual = Math.max(0, state.annualAmount - nearTermNeed);
  const financialComprehensiveWatch = state.financialIncome > 2000;
  const isaBlocked = state.taxProfile === "globalTaxed" || financialComprehensiveWatch;
  const healthSensitive = state.taxProfile === "dependent" || state.taxProfile === "retired";
  const insuranceIncome = state.financialIncome + (state.taxProfile === "retired" ? state.privatePensionIncome : 0);
  const financialInsuranceWatch = insuranceIncome > 1000;
  const pensionIncomeWatch = state.privatePensionIncome >= 1500;
  const liquidityWatch = nearTermNeed >= Math.max(300, state.annualAmount * 0.35) || state.horizon <= 3;
  const pensionCreditCapacity = profile.pensionCreditRate > 0 ? totalCreditTaxDue() / profile.pensionCreditRate : 0;

  return {
    nearTermNeed,
    lockableAnnual,
    isaBlocked,
    healthSensitive,
    insuranceIncome,
    financialInsuranceWatch,
    financialComprehensiveWatch,
    pensionIncomeWatch,
    liquidityWatch,
    pensionCreditCapacity,
    isaCapacity: isaBlocked ? 0 : Math.min(Math.max(0, state.isaRoom), state.annualAmount),
  };
}

function buildPlan() {
  const annual = Math.max(0, state.annualAmount);
  const profile = salaryProfile();
  const gates = riskSettings(profile);
  const isShort = state.horizon <= 5;
  const isLong = state.horizon >= 15;
  const dcContribution = estimateDcContribution();
  const foreignPressure = state.foreignGain > 250 ? Math.min(1, (state.foreignGain - 250) / 2750) : 0;
  const dividendPressure = state.dividendIncome >= 1000 ? Math.min(1, state.dividendIncome / 2500) : 0;
  const lockableAnnual = gates.lockableAnnual;
  const multiplier = householdMultiplier();
  const pensionCreditLimit = LIMITS.pensionCredit * multiplier;
  const pensionTotalCreditLimit = LIMITS.pensionTotalCredit * multiplier;
  const creditEligibleRoom = Math.min(pensionTotalCreditLimit, Math.max(0, gates.pensionCreditCapacity));
  const pensionRiskScale = gates.pensionIncomeWatch && state.age >= 50 ? 0.55 : 1;

  if (annual <= 900) {
    const isaTarget = Math.min(gates.isaCapacity, lockableAnnual * (isShort ? 0.38 : 0.52));
    const pensionTarget = Math.min(
      pensionCreditLimit,
      creditEligibleRoom,
      lockableAnnual * (isLong ? 0.14 : 0.06) * pensionRiskScale,
    );
    const smallAmounts = normalizeUserAmountsToAnnual(
      {
        isa: isaTarget,
        pension: pensionTarget,
        irp: 0,
        foreign: annual * (state.persona === "global" ? 0.1 : 0.04),
      },
      annual,
    );
    const amountByAccount = { ...smallAmounts, dc: dcContribution };
    return { amountByAccount, allocation: normalizeAllocation(amountByAccount), dcContribution, salaryProfile: profile, gates };
  }

  const isaBase =
    state.persona === "starter" ? 0.42 :
    state.persona === "global" ? 0.34 :
    state.persona === "taxShield" ? 0.26 :
    0.24;
  const pensionBase =
    state.persona === "taxShield" ? 0.25 :
    state.persona === "retirement" ? 0.2 :
    0.11;
  const irpBase =
    state.persona === "taxShield" ? 0.13 :
    state.persona === "retirement" ? 0.11 :
    0.035;
  const foreignBase =
    state.persona === "global" ? 0.24 :
    state.persona === "starter" ? 0.06 :
    0.1;

  const isaTarget = Math.min(
    gates.isaCapacity,
    lockableAnnual,
    lockableAnnual * (isaBase + dividendPressure * 0.05 + foreignPressure * 0.04 - (isLong ? 0.03 : 0)),
  );
  const pensionTarget = Math.min(
    pensionCreditLimit,
    creditEligibleRoom,
    lockableAnnual * (pensionBase + (profile.pensionCreditRate === 0.165 ? 0.04 : 0) + (isLong ? 0.05 : 0) + (state.age >= 50 ? 0.03 : 0)) * pensionRiskScale,
  );
  const irpLimit = Math.max(0, Math.min(pensionTotalCreditLimit, creditEligibleRoom) - pensionTarget);
  const irpTarget = Math.min(
    irpLimit,
    Math.max(0, lockableAnnual - pensionTarget - isaTarget),
    lockableAnnual * (irpBase + (isLong ? 0.03 : 0) + (state.age >= 50 ? 0.02 : 0)) * pensionRiskScale,
  );
  const foreignTarget = annual * Math.max(
    0.03,
    foreignBase - foreignPressure * 0.08 - (state.age >= 50 ? 0.03 : 0),
  );
  const userAmounts = normalizeUserAmountsToAnnual(
    {
      isa: isaTarget,
      pension: pensionTarget,
      irp: irpTarget,
      foreign: foreignTarget,
    },
    annual,
  );
  const amounts = { ...userAmounts, dc: dcContribution };

  return { amountByAccount: amounts, allocation: normalizeAllocation(amounts), dcContribution, salaryProfile: profile, gates };
}

function calculate() {
  const { allocation, amountByAccount, dcContribution, salaryProfile: profile, gates } = buildPlan();
  const annual = state.annualAmount;
  const expectedReturn = state.expectedReturn / 100;
  const multiplier = householdMultiplier();
  const pensionEligible = Math.min(amountByAccount.pension, LIMITS.pensionCredit * multiplier);
  const irpEligible = Math.min(amountByAccount.irp, Math.max(0, LIMITS.pensionTotalCredit * multiplier - pensionEligible));
  const creditRate = profile.pensionCreditRate;
  const rawPensionCredit = (pensionEligible + irpEligible) * creditRate;
  const pensionCredit = Math.min(rawPensionCredit, totalCreditTaxDue());
  const lostPensionCredit = Math.max(0, rawPensionCredit - pensionCredit);

  const isaGain = amountByAccount.isa * expectedReturn * 3;
  const isaExemption = profile.isaExemption;
  const regularIsaTax = isaGain * 0.154;
  const isaTax = Math.max(0, isaGain - isaExemption) * 0.099;
  const isaSaving = Math.max(0, regularIsaTax - isaTax) / 3;

  const foreignTax = Math.max(0, state.foreignGain - 250) * 0.22;
  const foreignManagementSaving = foreignTax * Math.min(0.7, allocation.isa / 100 + allocation.domestic / 220);
  const dividendTax = state.dividendIncome * 0.154;
  const dividendDeferral = dividendTax * ((allocation.isa + allocation.pension + allocation.irp + allocation.dc) / 100) * 0.35;
  const healthInsuranceCost = estimateHealthInsuranceCost(gates);

  const annualDefenseGross = pensionCredit + isaSaving + foreignManagementSaving + dividendDeferral;
  const annualDefense = annualDefenseGross - healthInsuranceCost;
  const rate = expectedReturn;
  const factor = futureValueFactor(rate, state.horizon);
  const compound = annualDefense * factor;
  const annualContribution = annual + dcContribution;
  const regularWealth = annualContribution * factor;
  const optimizedGrossWealth = (annualContribution + annualDefense) * factor;
  const pensionExitTax = estimatePensionExitTax(amountByAccount, state.horizon, rate, gates);
  const optimizedWealth = optimizedGrossWealth - pensionExitTax;
  const gap = optimizedWealth - regularWealth;
  const riskPenalty =
    (gates.isaBlocked ? 16 : 0) +
    (gates.liquidityWatch ? 10 : 0) +
    (gates.pensionIncomeWatch ? 8 : 0) +
    (gates.healthSensitive && gates.financialInsuranceWatch ? 8 : 0) +
    (gates.financialComprehensiveWatch ? 8 : 0) +
    (healthInsuranceCost > 0 ? 10 : 0) +
    (pensionExitTax > 0 ? 6 : 0) +
    (lostPensionCredit > 0 ? 8 : 0) +
    (state.taxDue < 50 ? 6 : 0);
  const score = clamp(
    Math.round(
      48 +
        allocation.isa * 0.19 +
        (allocation.pension + allocation.irp) * 0.22 +
        allocation.dc * 0.1 -
        allocation.foreign * 0.13 +
        (annualDefense / Math.max(annual, 1)) * 95 -
        riskPenalty,
    ),
    0,
    100,
  );

  return {
    allocation,
    amountByAccount,
    annualContribution,
    dcContribution,
    salaryProfile: profile,
    gates,
    rawPensionCredit,
    pensionCredit,
    lostPensionCredit,
    healthInsuranceCost,
    annualDefenseGross,
    pensionExitTax,
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

function futureValueFactor(rate, years) {
  if (years <= 0) return 0;
  if (Math.abs(rate) < 0.00001) return years;
  return ((1 + rate) ** years - 1) / rate;
}

function riskGateFor(result) {
  const items = [];
  const gates = result.gates;

  if (gates.isaBlocked) {
    items.push("금융소득종합과세 이력 또는 금융소득 2,000만원 초과 입력으로 ISA 배분을 0원 처리했습니다.");
  } else if (state.isaRoom !== LIMITS.isaAnnual) {
    items.push(`ISA 배분은 입력한 올해 납입 여력 ${formatManwon(state.isaRoom)} 안에서만 계산했습니다.`);
  }

  if (result.lostPensionCredit > 0) {
    items.push(`결정세액 부족으로 연금 세액공제 약 ${formatManwon(result.lostPensionCredit)}은 환급 효과에서 제외했습니다.`);
  } else if (state.taxDue < 50) {
    items.push(`예상 결정세액이 ${formatManwon(state.taxDue)}이라 연금 세액공제 계좌 배분을 보수적으로 낮췄습니다.`);
  }

  if (gates.liquidityWatch) {
    items.push(`3년 내 필요자금 ${formatManwon(gates.nearTermNeed)}은 ISA·연금계좌보다 유동성 버킷이 우선입니다.`);
  }

  if (gates.pensionIncomeWatch) {
    items.push("사적연금 연 1,500만원 경계에서는 연금 수령 방식과 과세 선택을 먼저 점검합니다.");
  }

  if (result.pensionExitTax > 0) {
    items.push(`그래프 최종값은 연금계좌 인출세 추정 ${formatManwon(result.pensionExitTax)}을 차감한 순자산입니다.`);
  }

  if (gates.healthSensitive && gates.financialInsuranceWatch) {
    items.push(`피부양자·은퇴 예정자 건보료 비용을 연 ${formatManwon(result.healthInsuranceCost)} 차감했습니다.`);
  }

  if (gates.financialComprehensiveWatch) {
    items.push("금융소득 2,000만원 이상 구간은 종합과세와 ISA 적격성 확인이 먼저입니다.");
  }

  if (state.persona === "global") {
    items.push("달러 보유 자체가 목적이라면 ISA 내 원화 ETF 대체가 환노출 목표와 맞는지 별도 검토합니다.");
  }

  if (state.age >= 58 || state.horizon <= 5) {
    items.push("은퇴가 가깝거나 기간이 짧으면 DC형 원리금보장 상품도 방어 자산 후보입니다.");
  }

  if (state.householdMode === "couple") {
    items.push("부부 모드는 명의별 계좌 자격과 배우자 증여 공제 범위를 따로 확인해야 합니다.");
  }

  if (items.length < 3) {
    items.push("부부 공동 자금은 명의별 한도와 배우자 증여 공제 범위를 나눠서 봅니다.");
  }
  if (items.length < 3) {
    items.push("ISA·연금계좌는 혜택보다 먼저 최소 보유 기간과 중도해지 비용을 확인합니다.");
  }
  if (items.length < 3) {
    items.push("해외주식 기본공제 활용은 손익통산, 결제일, 환전·매매 비용을 같이 비교합니다.");
  }
  const severe = [
    gates.isaBlocked,
    gates.pensionIncomeWatch,
    gates.healthSensitive && gates.financialInsuranceWatch,
    gates.financialComprehensiveWatch,
    result.lostPensionCredit > 0,
    state.taxDue < 50,
    result.healthInsuranceCost > 0,
  ].filter(Boolean).length;
  const level = severe >= 2 || gates.isaBlocked ? "주의 높음" : severe === 1 || gates.liquidityWatch ? "조건부 진행" : "기본 통과";

  return { level, items: items.slice(0, 4) };
}

function adviceFor(result) {
  const allocation = result.allocation;
  const taxShelterShare = allocation.isa + allocation.pension + allocation.irp + allocation.dc;
  const pensionStack = allocation.pension + allocation.irp + allocation.dc;
  const pensionRoom = Math.max(0, 900 - Math.min(result.amountByAccount.pension, 600) - Math.min(result.amountByAccount.irp, 900));
  const foreignTaxExposure = result.foreignTax;
  const dividendTax = state.dividendIncome * 0.154;
  const lead = leadAccount(allocation);
  const dcShareOfPool = (result.dcContribution / Math.max(result.annualContribution, 1)) * 100;
  const gates = result.gates;

  if (gates.isaBlocked) {
    return {
      title: "ISA 가입 결격 가능성이 먼저입니다. 금융소득 2,000만원 초과 또는 최근 종합과세 이력이 있으면 ISA 배분은 제외합니다.",
      items: [
        "ISA를 0원으로 두고, 일반 계좌·연금계좌·해외직투의 세후 비용을 다시 비교합니다.",
        `현재 금융소득 입력값은 연 ${formatManwon(state.financialIncome)}입니다. 화면의 ISA 배분도 0원으로 강제 처리했습니다.`,
        "고액 자산가는 절세 계좌 한도보다 건보료, 종합과세, 유동성 제약을 먼저 검증합니다.",
      ],
    };
  }

  if (result.lostPensionCredit > 0) {
    return {
      title: "연금 세액공제는 환급 가능한 세금 안에서만 의미가 있습니다. 결정세액을 넘는 공제액은 이번 계산에서 제외했습니다.",
      items: [
        `예상 결정세액 ${formatManwon(state.taxDue)} 대비 소멸 가능 공제액은 약 ${formatManwon(result.lostPensionCredit)}입니다.`,
        "환급받을 세금이 작다면 연금계좌 한도 채우기보다 ISA, 현금성 자금, 일반 계좌 유동성을 먼저 봅니다.",
        "연금 납입은 세액공제 액션이 아니라 55세 이후까지 묶어둘 수 있는 장기 자금인지로 재판단합니다.",
      ],
    };
  }

  if (state.taxDue < 50 && state.annualAmount >= 900) {
    return {
      title: "예상 결정세액이 작습니다. 연금 한도 채우기보다 환급 가능한 세금 규모부터 확인해야 합니다.",
      items: [
        `입력한 예상 결정세액은 ${formatManwon(state.taxDue)}입니다.`,
        "연금저축·IRP는 공제 한도보다 실제 환급 가능한 세금이 먼저입니다.",
        "돌려받을 세금이 작다면 ISA 납입 여력, 일반 계좌 유동성, 단기 목표자금을 우선 배치합니다.",
      ],
    };
  }

  if (gates.liquidityWatch) {
    return {
      title: "3년 안에 필요한 자금이 큽니다. 절세 계좌보다 유동성 방어가 먼저입니다.",
      items: [
        `입력한 3년 내 필요자금은 ${formatManwon(gates.nearTermNeed)}이고, 묶어둘 수 있는 금액은 약 ${formatManwon(gates.lockableAnnual)}입니다.`,
        "ISA는 최소 3년을 통과할 돈만 넣고, 연금저축·IRP는 중도해지 세금까지 감당 가능한 금액으로 제한합니다.",
        "전세, 청약, 대출상환, 결혼자금처럼 일정이 있는 돈은 절세 점수 계산에서 별도 현금 버킷으로 빼야 합니다.",
      ],
    };
  }

  if (gates.healthSensitive && gates.financialInsuranceWatch) {
    return {
      title: "금융소득이 건보료 경계에 걸립니다. 세금보다 건강보험료와 피부양자 자격을 먼저 확인해야 합니다.",
      items: [
        `건보료 비용 추정치 연 ${formatManwon(result.healthInsuranceCost)}을 연간 방어 가치에서 차감했습니다.`,
        "피부양자 또는 은퇴 예정자는 금융소득이 보험료 산정 소득에 반영되는지 확인한 뒤 배당·분배금 자산을 배치합니다.",
        "절세계좌 만기 자금을 연금계좌로 넘길 때도 향후 연금 수령액과 건보료 영향을 함께 봅니다.",
      ],
    };
  }

  if (gates.pensionIncomeWatch) {
    return {
      title: "예상 사적연금 수령액이 1,500만원 경계에 있습니다. 과세이연보다 수령 설계가 먼저입니다.",
      items: [
        `입력한 예상 사적연금 수령액은 연 ${formatManwon(state.privatePensionIncome)}입니다.`,
        "연금저축·IRP 납입을 늘리기 전에 수령 기간, 국민연금, 다른 소득, 분리과세 선택 가능성을 함께 계산합니다.",
        "ISA 만기 전환 10% 세액공제도 유동성 락인과 향후 연금 수령액 증가를 같이 따져야 합니다.",
      ],
    };
  }

  if (result.dcContribution >= 700 && dcShareOfPool >= 18 && (state.horizon >= 10 || state.age >= 45)) {
    return {
      title: "총급여 기준 DC 회사부담금이 커졌습니다. 퇴직연금은 나이와 금리 환경에 맞춰 방어·성장 비중을 다시 정해야 합니다.",
      items: [
        `연 총급여 ${formatManwon(state.totalSalary)} 기준 DC 회사부담금 추정액은 연 ${formatManwon(result.dcContribution)}입니다.`,
        `향후 1년 투자/운용 풀에서 DC형이 차지하는 비중은 약 ${Math.round(dcShareOfPool)}%입니다.`,
        state.age >= 58 || state.horizon <= 5 ? "은퇴가 가까우면 고금리 원리금보장 상품도 방어 전략이 될 수 있습니다." : "은퇴까지 시간이 남았다면 원리금보장·실적배당 비중을 연금저축·IRP와 합산해 점검합니다.",
      ],
    };
  }

  if (state.annualAmount <= 900) {
    return {
      title: "시드머니 단계에서는 계좌를 많이 늘리기보다 ISA 중심으로 출금 가능성을 지키는 편이 낫습니다.",
      items: [
        `연간 투자금 ${formatManwon(state.annualAmount)} 구간에서는 추천 1순위가 ${lead}입니다.`,
        `연금저축·IRP·DC형 합산 비중은 ${pensionStack}%로 낮춰, 급한 지출 때문에 장기 계좌를 깨는 일을 줄입니다.`,
        state.horizon < 7 ? "투자 기간이 짧으므로 세액공제보다 최소 3년 이상 묶어둘 수 있는 금액을 먼저 봅니다." : "기간이 길어질수록 연금저축을 소액 자동납입으로 붙여도 부담이 작아집니다.",
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
        "실현이익을 한 해에 몰지 말고 손실 종목, 환율, 결제일, 매도 연도를 같이 봅니다.",
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
        `연간 투자금 ${formatManwon(state.annualAmount)}과 DC 추정액 ${formatManwon(result.dcContribution)}을 합친 기준에서 절세계좌 비중은 ${taxShelterShare}%입니다.`,
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
        "실현이익이 커지는 해에는 손실 통산, 매도 분산, 거래비용, 국내 상장 해외 ETF 대체 가능성을 같이 검토합니다.",
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
  qs("#salaryLabel").textContent = formatManwon(state.totalSalary);
  qs("#horizonLabel").textContent = `${state.horizon}년`;
  qs("#returnLabel").textContent = `${state.expectedReturn.toFixed(1)}%`;
  qs("#nearTermNeedLabel").textContent = formatManwon(state.nearTermNeed);
  qs("#taxDueLabel").textContent = formatManwon(state.taxDue);
  qs("#isaRoomLabel").textContent = formatManwon(state.isaRoom);
  qs("#financialIncomeLabel").textContent = formatManwon(state.financialIncome);
  qs("#privatePensionLabel").textContent = formatManwon(state.privatePensionIncome);
  qs("#spouseTaxDueLabel").textContent = formatManwon(state.spouseTaxDue);
  qs("#profileLabel").textContent = TAX_PROFILE_LABELS[state.taxProfile] ?? "일반";
  qs("#householdLabel").textContent = HOUSEHOLD_MODE_LABELS[state.householdMode] ?? "개인 기준";
}

function renderAllocation(allocation, amountByAccount, result) {
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
    .map((account) => ({ ...account, amount: amountByAccount[account.key] ?? 0, percent: allocation[account.key] }))
    .map(
      ({ label, color, amount, percent }) => `
        ${label === accounts[0].label ? `
          <div class="allocation-note">
            <span>향후 1년 투자/운용 배분</span>
            <small>${HOUSEHOLD_MODE_LABELS[state.householdMode]} · 투자 가능 금액 ${formatManwon(state.annualAmount)} + DC 회사부담금 추정 ${formatManwon(result.dcContribution)} 기준입니다. ${result.salaryProfile.label}</small>
          </div>
        ` : ""}
        <div class="allocation-row">
          <span>${label}</span>
          <div class="allocation-track"><i style="width: ${percent}%; background: ${color}"></i></div>
          <strong>${percent}%</strong>
          <small>${formatManwon(amount)}</small>
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

  const rate = state.expectedReturn / 100;
  const points = Array.from({ length: state.horizon + 1 }, (_, year) => {
    const factor = futureValueFactor(rate, year);
    const regular = result.annualContribution * factor;
    const pensionExitTax = estimatePensionExitTax(result.amountByAccount, year, rate, result.gates);
    const optimized = (result.annualContribution + result.annualDefense) * factor - pensionExitTax;
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

  drawLine("regular", "#7a8594", 3);
  drawLine("optimized", "#4d7c65", 4);

  context.fillStyle = "#171a1f";
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
  const riskGate = riskGateFor(result);
  qs("#savingMetric").textContent = formatManwon(result.annualDefense);
  qs("#compoundMetric").textContent = formatManwon(result.compound);
  qs("#compoundCaption").textContent = `연 ${state.expectedReturn.toFixed(1)}% · ${state.horizon}년 재투자`;
  qs("#scoreMetric").textContent = String(result.score);
  qs("#scoreCaption").textContent = riskGate.level;
  qs("#gapMetric").textContent = `차이 ${formatManwon(result.gap)}`;
  qs("#chartAssumption").textContent = `연 ${state.expectedReturn.toFixed(1)}% 가정 · 건보료 비용과 연금 인출세 추정치를 차감한 순자산`;
  qs("#oneLineAdvice").textContent = advice.title;
  qs("#actionItems").innerHTML = advice.items.map((item) => `<li>${item}</li>`).join("");
  qs("#riskLevel").textContent = riskGate.level;
  qs("#riskItems").innerHTML = riskGate.items.map((item) => `<li>${item}</li>`).join("");
  qs("#heroTaxDrag").textContent = `연 ${formatManwon(result.annualDefense)}`;
  qs("#heroRegular").textContent = `세후 ${formatManwon(result.regularWealth)}`;
  qs("#heroOptimized").textContent = `세후 ${formatManwon(result.optimizedWealth)}`;
  renderAllocation(result.allocation, result.amountByAccount, result);
  drawWealthChart(result);
}

function applyPersona(persona) {
  state.persona = persona;
  Object.assign(state, personaDefaults[persona]);
  qsa(".persona-switch button").forEach((button) => button.classList.toggle("active", button.dataset.value === persona));
  numericFields.forEach((id) => {
    qs(`#${id}`).value = state[id];
  });
  qs("#taxProfile").value = state.taxProfile;
  qs("#householdMode").value = state.householdMode;
  render();
}

function bindControls() {
  qsa(".persona-switch button").forEach((button) => {
    button.addEventListener("click", () => applyPersona(button.dataset.value));
  });

  numericFields.forEach((id) => {
    qs(`#${id}`).addEventListener("input", (event) => {
      state[id] = Number(event.target.value);
      render();
    });
  });
  qs("#taxProfile").addEventListener("change", (event) => {
    state.taxProfile = event.target.value;
    render();
  });
  qs("#householdMode").addEventListener("change", (event) => {
    state.householdMode = event.target.value;
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
  qsa(".top-nav nav a").forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href") === `#${sceneIds[activeScene]}`);
  });
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
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-visible", entry.isIntersecting);
      });
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
  qs(`#${sceneIds[activeScene]}`).classList.add("is-visible");
  updateSceneUI();

  window.addEventListener("scroll", () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    qs("#progressLine").style.width = `${maxScroll > 0 ? (window.scrollY / maxScroll) * 100 : 0}%`;
  }, { passive: true });
}

function setActiveAccount(accountKey) {
  qsa("[data-account]").forEach((element) => {
    const isActive = element.dataset.account === accountKey;
    element.classList.toggle("is-selected", isActive);
    if (element.classList.contains("route-card")) {
      element.setAttribute("aria-pressed", String(isActive));
    }
  });
}

function bindAccountMap() {
  const cards = qsa(".route-card[data-account]");
  if (!cards.length) return;
  cards.forEach((card) => {
    card.setAttribute("role", "button");
    card.addEventListener("click", () => setActiveAccount(card.dataset.account));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      setActiveAccount(card.dataset.account);
    });
  });
  setActiveAccount("isa");
}

function setSp500Mode(mode) {
  qsa("[data-sp500-mode]").forEach((button) => {
    const isActive = button.dataset.sp500Mode === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  qsa("[data-case-kind]").forEach((row) => {
    row.classList.toggle("is-active", row.dataset.caseKind === mode);
  });
}

function bindSp500Case() {
  const buttons = qsa("[data-sp500-mode]");
  if (!buttons.length) return;
  buttons.forEach((button) => {
    button.addEventListener("click", () => setSp500Mode(button.dataset.sp500Mode));
  });
  setSp500Mode(buttons.find((button) => button.classList.contains("active"))?.dataset.sp500Mode ?? "gain");
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
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  const lanes = [
    { y: height * 0.28, color: "rgba(77,124,101,0.38)", speed: 0.8 },
    { y: height * 0.46, color: "rgba(49,95,140,0.42)", speed: 0.55 },
    { y: height * 0.64, color: "rgba(185,130,63,0.36)", speed: 0.38 },
  ];

  lanes.forEach((lane, laneIndex) => {
    ctx.strokeStyle = "rgba(49,95,140,0.12)";
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

  ctx.fillStyle = "rgba(49,95,140,0.055)";
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
bindAccountMap();
bindSp500Case();
render();
animateHero();
