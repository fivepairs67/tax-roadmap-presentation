# 투자 계좌 절세 로드맵 발표용 동적웹

공유 ChatGPT 대화의 요구사항을 바탕으로 만든 독립형 발표용 웹입니다.
`kflow` 프로젝트와 분리되어 있으며, 서버 없이 `index.html`을 브라우저에서 열면 실행됩니다.

## 구성

- `index.html`: 발표 섹션과 인터랙티브 시뮬레이터 마크업
- `styles.css`: 반응형 발표 레이아웃, 계좌 카드, 차트 스타일
- `app.js`: 슬라이드 이동, 입력 상태, 계좌 조합 및 절세 가치 계산

## 배포

- GitHub: https://github.com/fivepairs67/tax-roadmap-presentation
- Cloudflare Pages: https://tax-roadmap-presentation.pages.dev/

재배포 명령:

```bash
npx wrangler pages deploy . --project-name tax-roadmap-presentation --branch main
```

## 계산 기준

- 연금저축 세액공제 대상은 최대 600만원, 연금저축+IRP 합산 최대 900만원으로 단순화했습니다.
- 세액공제율은 지방소득세 포함 체감 기준으로 16.5% 또는 13.2%를 적용했습니다.
- ISA는 일반형 200만원, 서민형 400만원 비과세 한도와 초과분 9.9% 분리과세를 단순화했습니다.
- 해외직투는 연간 순이익 250만원 공제 후 22% 양도소득세 노출을 단순 추정합니다.
- 모든 결과는 발표용 추정값이며 실제 세액은 개인 조건과 법령 적용 시점에 따라 달라질 수 있습니다.

## 주요 출처

- 금융위원회 ISA: https://www.fsc.go.kr/po020201/27339
- 국세청 해외주식 양도소득: https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=8800
- 국세청 연금계좌: https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7875
- 고용노동부 퇴직연금: https://www.moel.go.kr/retirementpay.do
