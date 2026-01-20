import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Info, Copy, Calculator, TrendingUp, Receipt, MapPin, Train, Building2 } from "lucide-react";

// --- Utilities ---
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function formatJPY(n: number): string {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return v.toLocaleString("ja-JP") + "円";
}

function formatPct(r: number): string {
  const v = Number.isFinite(r) ? r * 100 : 0;
  return `${v.toFixed(1)}%`;
}

function safeDiv(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  return a / b;
}

function numOr0(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// --- Presets ---
type IndustryKey =
  | "izakaya"
  | "yakiniku"
  | "cafe"
  | "ramen"
  | "restaurant"
  | "takeout";

type ScenarioKey = "low" | "standard" | "high";

type RatePreset = {
  label: string;
  scenarios: Record<ScenarioKey, { food: number; labor: number; rent: number }>;
};

const INDUSTRY_PRESETS: Record<IndustryKey, RatePreset> = {
  izakaya: {
    label: "居酒屋",
    scenarios: {
      low: { food: 0.28, labor: 0.26, rent: 0.09 },
      standard: { food: 0.30, labor: 0.30, rent: 0.10 },
      high: { food: 0.33, labor: 0.34, rent: 0.12 },
    },
  },
  yakiniku: {
    label: "焼肉",
    scenarios: {
      low: { food: 0.34, labor: 0.24, rent: 0.09 },
      standard: { food: 0.38, labor: 0.28, rent: 0.10 },
      high: { food: 0.42, labor: 0.32, rent: 0.12 },
    },
  },
  cafe: {
    label: "カフェ",
    scenarios: {
      low: { food: 0.24, labor: 0.28, rent: 0.10 },
      standard: { food: 0.28, labor: 0.32, rent: 0.12 },
      high: { food: 0.32, labor: 0.36, rent: 0.14 },
    },
  },
  ramen: {
    label: "ラーメン",
    scenarios: {
      low: { food: 0.26, labor: 0.22, rent: 0.08 },
      standard: { food: 0.30, labor: 0.25, rent: 0.10 },
      high: { food: 0.34, labor: 0.28, rent: 0.12 },
    },
  },
  restaurant: {
    label: "レストラン（一般）",
    scenarios: {
      low: { food: 0.28, labor: 0.26, rent: 0.09 },
      standard: { food: 0.32, labor: 0.30, rent: 0.10 },
      high: { food: 0.36, labor: 0.34, rent: 0.12 },
    },
  },
  takeout: {
    label: "テイクアウト中心",
    scenarios: {
      low: { food: 0.32, labor: 0.18, rent: 0.06 },
      standard: { food: 0.35, labor: 0.20, rent: 0.08 },
      high: { food: 0.38, labor: 0.24, rent: 0.10 },
    },
  },
};

const DAYS_OPTIONS = [22, 24, 26, 28, 30] as const;
const PEOPLE_PER_GROUP_OPTIONS = [1, 2, 3, 4, 5, 6] as const;
const TURNOVER_OPTIONS = [1.2, 1.5, 2.0, 2.5, 3.0] as const;
const OCCUPANCY_OPTIONS = [0.45, 0.55, 0.65, 0.75, 0.85] as const;
const SEATS_PER_TSUBO_OPTIONS = [1.6, 1.8, 2.0, 2.2, 2.4] as const;

type UnitType = "per_person" | "per_group";

// --- Area / Rent Master (Editable) ---
type AreaKey =
  | "tokyo_core"
  | "tokyo_suburb"
  | "osaka_core"
  | "osaka_suburb"
  | "nagoya_core"
  | "kyoto_core"
  | "regional_city"
  | "rural";

type AreaMaster = {
  key: AreaKey;
  label: string;
  // base rent per tsubo per month (JPY). These are placeholder defaults; you should tune them to your dataset.
  baseRentPerTsubo: number;
  // keyword patterns for rough address detection
  patterns: RegExp[];
};

const AREA_MASTER: AreaMaster[] = [
  {
    key: "tokyo_core",
    label: "東京 都心（都心部・23区中心）",
    baseRentPerTsubo: 35000,
    patterns: [
      /東京都/,
      /渋谷|新宿|港区|中央区|千代田区|品川|池袋|恵比寿|六本木|銀座/,
    ],
  },
  {
    key: "tokyo_suburb",
    label: "東京 近郊（23区外・近郊）",
    baseRentPerTsubo: 25000,
    patterns: [/東京都/, /立川|町田|八王子|府中|調布|武蔵|多摩/],
  },
  {
    key: "osaka_core",
    label: "大阪 都心（梅田/難波/心斎橋など）",
    baseRentPerTsubo: 28000,
    patterns: [/大阪府/, /北区|中央区|西区|天王寺|難波|梅田|心斎橋|本町/],
  },
  {
    key: "osaka_suburb",
    label: "大阪 近郊（大阪市外・北摂・東大阪など）",
    baseRentPerTsubo: 20000,
    patterns: [/大阪府/, /吹田|豊中|東大阪|堺|枚方|高槻|守口|八尾/],
  },
  {
    key: "kyoto_core",
    label: "京都 中心（四条/河原町/烏丸など）",
    baseRentPerTsubo: 24000,
    patterns: [/京都府/, /中京区|下京区|四条|河原町|烏丸|祇園/],
  },
  {
    key: "nagoya_core",
    label: "名古屋 中心（栄/名駅など）",
    baseRentPerTsubo: 22000,
    patterns: [/愛知県/, /名古屋|栄|名駅|中区/],
  },
  {
    key: "regional_city",
    label: "地方都市（駅前・中心街）",
    baseRentPerTsubo: 15000,
    patterns: [/奈良県|兵庫県|滋賀県|和歌山県|福岡県|広島県|宮城県|北海道/],
  },
  {
    key: "rural",
    label: "郊外・地方（ロードサイド/住宅地寄り）",
    baseRentPerTsubo: 9000,
    patterns: [/郡|町|村/],
  },
];

type StationDistanceKey = "walk_1_3" | "walk_4_7" | "walk_8_12" | "walk_13_plus" | "unknown";
const STATION_DISTANCE: Record<StationDistanceKey, { label: string; factor: number }> = {
  walk_1_3: { label: "徒歩1〜3分", factor: 1.15 },
  walk_4_7: { label: "徒歩4〜7分", factor: 1.0 },
  walk_8_12: { label: "徒歩8〜12分", factor: 0.9 },
  walk_13_plus: { label: "徒歩13分以上", factor: 0.8 },
  unknown: { label: "不明", factor: 1.0 },
};

type TradeAreaKey =
  | "downtown"
  | "station_front"
  | "office"
  | "residential"
  | "roadside"
  | "tourism";

const TRADE_AREA: Record<TradeAreaKey, { label: string; factor: number }> = {
  downtown: { label: "繁華街", factor: 1.2 },
  station_front: { label: "駅前", factor: 1.1 },
  office: { label: "オフィス街", factor: 1.1 },
  residential: { label: "住宅街", factor: 0.95 },
  roadside: { label: "ロードサイド", factor: 0.9 },
  tourism: { label: "観光地", factor: 1.25 },
};

function detectAreaFromAddress(address: string): AreaKey | null {
  const a = (address || "").trim();
  if (!a) return null;

  // Prefer more specific matches first
  for (const area of AREA_MASTER) {
    if (area.patterns.some((re) => re.test(a))) return area.key;
  }
  return null;
}

function getArea(key: AreaKey): AreaMaster {
  return AREA_MASTER.find((x) => x.key === key) || AREA_MASTER[0];
}

export default function RestaurantPrevisitCalculator() {
  // --- Inputs ---
  const [address, setAddress] = useState<string>("");
  const [industry, setIndustry] = useState<IndustryKey>("izakaya");
  const [scenario, setScenario] = useState<ScenarioKey>("standard");

  const [unitType, setUnitType] = useState<UnitType>("per_person");
  const [unitPrice, setUnitPrice] = useState<number>(6000);
  const [peoplePerGroup, setPeoplePerGroup] = useState<number>(2);

  const [addGroupsPerDay, setAddGroupsPerDay] = useState<number>(1);
  const [seats, setSeats] = useState<number>(30);
  const [adSpend, setAdSpend] = useState<number>(100000);
  const [daysPerMonth, setDaysPerMonth] = useState<number>(26);

  // Optional baseline estimate (seat-based)
  const [useBaseline, setUseBaseline] = useState<boolean>(true);
  const [turnover, setTurnover] = useState<number>(2.0);
  const [occupancy, setOccupancy] = useState<number>(0.65);

  // --- Address -> Area / Rent suggestion ---
  const [autoDetectArea, setAutoDetectArea] = useState<boolean>(true);
  const [area, setArea] = useState<AreaKey>("regional_city");
  const [stationDistance, setStationDistance] = useState<StationDistanceKey>("walk_4_7");
  const [tradeArea, setTradeArea] = useState<TradeAreaKey>("station_front");
  const [seatsPerTsubo, setSeatsPerTsubo] = useState<number>(2.0);
  const [autoSetRentRate, setAutoSetRentRate] = useState<boolean>(true);

  // Manual override for rates
  const [manualRates, setManualRates] = useState<boolean>(false);
  const presetRates = INDUSTRY_PRESETS[industry].scenarios[scenario];
  const [foodRate, setFoodRate] = useState<number>(presetRates.food);
  const [laborRate, setLaborRate] = useState<number>(presetRates.labor);
  const [rentRate, setRentRate] = useState<number>(presetRates.rent);

  // Auto-detect area from address
  React.useEffect(() => {
    if (!autoDetectArea) return;
    const detected = detectAreaFromAddress(address);
    if (detected) setArea(detected);
  }, [address, autoDetectArea]);

  // Seat-based baseline revenue (independent from rates)
  const baseline = useMemo(() => {
    const ppg = clamp(peoplePerGroup, 1, 20);
    const seatsN = clamp(seats, 0, 500);
    const days = clamp(daysPerMonth, 1, 31);

    // Convert to per-person price for baseline estimation
    const pricePerPerson = unitType === "per_person" ? unitPrice : safeDiv(unitPrice, ppg);

    const coversPerDay = seatsN * occupancy * turnover;
    const baselineRevenueDaily = coversPerDay * pricePerPerson;
    const baselineRevenueMonthly = baselineRevenueDaily * days;

    return {
      ppg,
      seatsN,
      days,
      pricePerPerson,
      coversPerDay,
      baselineRevenueDaily,
      baselineRevenueMonthly,
    };
  }, [peoplePerGroup, seats, daysPerMonth, unitType, unitPrice, occupancy, turnover]);

  // Suggest rent from area master
  const rentSuggestion = useMemo(() => {
    const a = getArea(area);
    const seatsN = clamp(seats, 0, 500);
    const spt = clamp(seatsPerTsubo, 0.8, 4.0);
    const tsubo = safeDiv(seatsN, spt);

    const stationFactor = STATION_DISTANCE[stationDistance].factor;
    const tradeFactor = TRADE_AREA[tradeArea].factor;

    const rentPerTsubo = a.baseRentPerTsubo * stationFactor * tradeFactor;
    const estimatedRentMonthly = tsubo * rentPerTsubo;

    const baselineSales = baseline.baselineRevenueMonthly;
    const rentRateSuggested = baselineSales > 0 ? clamp(estimatedRentMonthly / baselineSales, 0, 0.35) : 0;

    return {
      areaLabel: a.label,
      rentPerTsubo,
      tsubo,
      estimatedRentMonthly,
      rentRateSuggested,
      baselineSales,
    };
  }, [area, stationDistance, tradeArea, seats, seatsPerTsubo, baseline.baselineRevenueMonthly]);

  // Sync preset -> local rates when industry/scenario changes (if not manual)
  React.useEffect(() => {
    if (!manualRates) {
      setFoodRate(presetRates.food);
      setLaborRate(presetRates.labor);
      if (autoSetRentRate && rentSuggestion.rentRateSuggested > 0) {
        setRentRate(rentSuggestion.rentRateSuggested);
      } else {
        setRentRate(presetRates.rent);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industry, scenario]);

  // Whenever the rent suggestion changes, optionally auto-apply it
  React.useEffect(() => {
    if (!autoSetRentRate) return;
    if (manualRates) return;
    if (rentSuggestion.rentRateSuggested <= 0) return;
    setRentRate(rentSuggestion.rentRateSuggested);
  }, [autoSetRentRate, manualRates, rentSuggestion.rentRateSuggested]);

  const normalized = useMemo(() => {
    const ppg = baseline.ppg;
    const seatsN = baseline.seatsN;
    const addG = clamp(addGroupsPerDay, 0, 200);
    const days = baseline.days;

    const food = clamp(foodRate, 0, 0.95);
    const labor = clamp(laborRate, 0, 0.95);
    const rent = clamp(rentRate, 0, 0.95);

    // Incremental revenue
    const addRevenueDaily = unitType === "per_person" ? unitPrice * addG * ppg : unitPrice * addG;
    const addRevenueMonthly = addRevenueDaily * days;

    // Contribution estimations
    const addGrossProfit = addRevenueMonthly * (1 - food);
    const addAfterFL = addRevenueMonthly * (1 - food - labor);
    const addAfterFLR = addRevenueMonthly * (1 - food - labor - rent);

    // Ads
    const roas = safeDiv(addRevenueMonthly, adSpend);
    const gpRoas = safeDiv(addGrossProfit, adSpend);

    // Breakeven groups/day to cover ad spend using gross profit
    const gpPerGroup = unitType === "per_person" ? unitPrice * ppg * (1 - food) : unitPrice * (1 - food);
    const breakevenGroupsPerDay_Gross = safeDiv(adSpend, gpPerGroup * days);

    // Baseline
    const baselineRevenueDaily = baseline.baselineRevenueDaily;
    const baselineRevenueMonthly = baseline.baselineRevenueMonthly;

    const baselineFood = baselineRevenueMonthly * food;
    const baselineLabor = baselineRevenueMonthly * labor;
    const baselineRent = baselineRevenueMonthly * rent;

    const baselineOperatingProfitApprox = baselineRevenueMonthly - baselineFood - baselineLabor - baselineRent - adSpend;

    const fl = food + labor;
    const flr = food + labor + rent;

    return {
      ppg,
      seatsN,
      addG,
      days,
      food,
      labor,
      rent,
      addRevenueDaily,
      addRevenueMonthly,
      addGrossProfit,
      addAfterFL,
      addAfterFLR,
      roas,
      gpRoas,
      breakevenGroupsPerDay_Gross,
      coversPerDay: baseline.coversPerDay,
      baselineRevenueDaily,
      baselineRevenueMonthly,
      baselineFood,
      baselineLabor,
      baselineRent,
      baselineOperatingProfitApprox,
      fl,
      flr,
    };
  }, [
    baseline,
    addGroupsPerDay,
    unitType,
    unitPrice,
    foodRate,
    laborRate,
    rentRate,
    adSpend,
  ]);

  const talkTrack = useMemo(() => {
    const lines: string[] = [];
    lines.push(`【事前試算（仮説）】`);
    if (address.trim()) lines.push(`・住所：${address.trim()}`);
    lines.push(`・業態：${INDUSTRY_PRESETS[industry].label}（${scenario === "low" ? "保守" : scenario === "high" ? "攻め" : "標準"}）`);

    lines.push(`・エリア：${rentSuggestion.areaLabel}`);
    lines.push(
      `・家賃推定：${formatJPY(rentSuggestion.estimatedRentMonthly)}/月（${formatJPY(
        rentSuggestion.rentPerTsubo
      )}/坪・推定${rentSuggestion.tsubo.toFixed(1)}坪）`
    );

    lines.push(`・目標：+${normalized.addG}組/日（営業日数 ${normalized.days}日）`);

    if (unitType === "per_person") {
      lines.push(`・客単価：${formatJPY(unitPrice)}/人、平均${normalized.ppg}人/組 想定`);
    } else {
      lines.push(`・客単価：${formatJPY(unitPrice)}/組、平均${normalized.ppg}人/組 想定`);
    }

    lines.push(`・増分売上：${formatJPY(normalized.addRevenueMonthly)}/月（${formatJPY(normalized.addRevenueDaily)}/日）`);
    lines.push(`・増分粗利（原価差引後）：${formatJPY(normalized.addGrossProfit)}/月（原価率 ${formatPct(normalized.food)}）`);
    lines.push(`・広告費：${formatJPY(adSpend)}/月 → ROAS ${normalized.roas.toFixed(2)}、粗利ROAS ${normalized.gpRoas.toFixed(2)}`);
    lines.push(`・広告回収の損益分岐（粗利ベース）：${normalized.breakevenGroupsPerDay_Gross.toFixed(2)}組/日`);
    lines.push(`・FL：${formatPct(normalized.fl)} / FLR：${formatPct(normalized.flr)}（"70%"目安はFLRで語られることが多い）`);

    if (useBaseline) {
      lines.push(
        `・席数：${normalized.seatsN}席、想定：稼働${Math.round(
          occupancy * 100
        )}%×回転${turnover} → ${normalized.coversPerDay.toFixed(1)}人/日`
      );
      lines.push(`・仮の月商：${formatJPY(normalized.baselineRevenueMonthly)}（席推定ベース）`);
      lines.push(`・ざっくり営業利益（FLR+広告のみ控除）：${formatJPY(normalized.baselineOperatingProfitApprox)}`);
    }

    lines.push(`\n※あくまで事前仮説。現場で「月商・原価率（棚卸）・人件費・家賃」を聞いて確定させます。`);
    return lines.join("\n");
  }, [
    address,
    industry,
    scenario,
    rentSuggestion,
    normalized,
    unitType,
    unitPrice,
    adSpend,
    occupancy,
    turnover,
    useBaseline,
  ]);

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // no-op
    }
  }

  return (
    <div className="min-h-screen w-full bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              <h1 className="text-2xl font-semibold tracking-tight">飲食店 事前試算（訪問前）</h1>
              <Badge variant="secondary">住所→エリア→家賃率(R) 自動セット</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              住所・客単価・席数・増やしたい組数/日・広告費から、増分売上/回収ライン/FLR目安を一発で出します。
              住所からエリア係数（駅距離/商圏/家賃相場）を当て、家賃率(R)を自動推定します。
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => copyToClipboard(talkTrack)}>
              <Copy className="mr-2 h-4 w-4" />
              提案トークをコピー
            </Button>
            <Button
              onClick={() => {
                setAddress("");
                setIndustry("izakaya");
                setScenario("standard");
                setUnitType("per_person");
                setUnitPrice(6000);
                setPeoplePerGroup(2);
                setAddGroupsPerDay(1);
                setSeats(30);
                setAdSpend(100000);
                setDaysPerMonth(26);
                setUseBaseline(true);
                setTurnover(2.0);
                setOccupancy(0.65);
                setAutoDetectArea(true);
                setArea("regional_city");
                setStationDistance("walk_4_7");
                setTradeArea("station_front");
                setSeatsPerTsubo(2.0);
                setAutoSetRentRate(true);
                setManualRates(false);
              }}
            >
              リセット
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                入力
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>住所</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="例：奈良県天理市◯◯…"
                  />
                </div>

                <div className="rounded-2xl border p-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <div className="text-sm font-medium">住所 → エリア係数</div>
                    <Badge variant="secondary">マスタ</Badge>
                  </div>

                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>エリア（自動判定）</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">ON</span>
                          <Switch checked={autoDetectArea} onCheckedChange={setAutoDetectArea} />
                        </div>
                      </div>
                      <Select value={area} onValueChange={(v) => setArea(v as AreaKey)}>
                        <SelectTrigger>
                          <SelectValue placeholder="エリア" />
                        </SelectTrigger>
                        <SelectContent>
                          {AREA_MASTER.map((a) => (
                            <SelectItem key={a.key} value={a.key}>
                              {a.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        ※ 数値はプレースホルダー。あなたの実データ（過去案件/不動産相場）に合わせてマスタを調整。
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>家賃率(R)を自動セット</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">ON</span>
                          <Switch checked={autoSetRentRate} onCheckedChange={setAutoSetRentRate} />
                        </div>
                      </div>
                      <div className="rounded-xl bg-muted/40 p-3">
                        <div className="text-xs text-muted-foreground">推定 家賃率(R)</div>
                        <div className="text-lg font-semibold">
                          {rentSuggestion.rentRateSuggested > 0 ? formatPct(rentSuggestion.rentRateSuggested) : "—"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          ※ 席推定の月商（仮説）に対して算出
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Train className="h-4 w-4" />
                        <Label>駅距離</Label>
                      </div>
                      <Select value={stationDistance} onValueChange={(v) => setStationDistance(v as StationDistanceKey)}>
                        <SelectTrigger>
                          <SelectValue placeholder="徒歩4〜7分" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATION_DISTANCE).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <Label>商圏タイプ</Label>
                      </div>
                      <Select value={tradeArea} onValueChange={(v) => setTradeArea(v as TradeAreaKey)}>
                        <SelectTrigger>
                          <SelectValue placeholder="駅前" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(TRADE_AREA).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>席/坪（目安）</Label>
                      <Select value={String(seatsPerTsubo)} onValueChange={(v) => setSeatsPerTsubo(Number(v))}>
                        <SelectTrigger>
                          <SelectValue placeholder="2.0" />
                        </SelectTrigger>
                        <SelectContent>
                          {SEATS_PER_TSUBO_OPTIONS.map((x) => (
                            <SelectItem key={x} value={String(x)}>
                              {x}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">例：2.0なら「10坪で20席」程度の感覚</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border p-3">
                      <div className="text-xs text-muted-foreground">推定 坪数</div>
                      <div className="font-semibold">{rentSuggestion.tsubo.toFixed(1)}坪</div>
                    </div>
                    <div className="rounded-xl border p-3">
                      <div className="text-xs text-muted-foreground">推定 坪単価家賃</div>
                      <div className="font-semibold">{formatJPY(rentSuggestion.rentPerTsubo)}/坪</div>
                    </div>
                    <div className="rounded-xl border p-3">
                      <div className="text-xs text-muted-foreground">推定 家賃（月）</div>
                      <div className="font-semibold">{formatJPY(rentSuggestion.estimatedRentMonthly)}</div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    ※ 将来は「住所→駅距離（徒歩分）→家賃相場（坪単価）」を外部API/自社DBで自動化して精度を上げられます。
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>業態（テンプレ）</Label>
                    <Select value={industry} onValueChange={(v) => setIndustry(v as IndustryKey)}>
                      <SelectTrigger>
                        <SelectValue placeholder="業態を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(INDUSTRY_PRESETS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>シナリオ</Label>
                    <Select value={scenario} onValueChange={(v) => setScenario(v as ScenarioKey)}>
                      <SelectTrigger>
                        <SelectValue placeholder="標準" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">保守</SelectItem>
                        <SelectItem value="standard">標準</SelectItem>
                        <SelectItem value="high">攻め</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>客単価の単位</Label>
                    <Select value={unitType} onValueChange={(v) => setUnitType(v as UnitType)}>
                      <SelectTrigger>
                        <SelectValue placeholder="選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_person">1人あたり</SelectItem>
                        <SelectItem value="per_group">1組あたり</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>顧客単価</Label>
                    <Input
                      inputMode="numeric"
                      value={String(unitPrice)}
                      onChange={(e) => setUnitPrice(numOr0(e.target.value))}
                      placeholder="例：6000"
                    />
                    <p className="text-xs text-muted-foreground">{unitType === "per_person" ? "円/人" : "円/組"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>平均人数/組</Label>
                    <Select value={String(peoplePerGroup)} onValueChange={(v) => setPeoplePerGroup(Number(v))}>
                      <SelectTrigger>
                        <SelectValue placeholder="2" />
                      </SelectTrigger>
                      <SelectContent>
                        {PEOPLE_PER_GROUP_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}人
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">※ 1組単価の場合も、席推定（月商）に使うため入力推奨</p>
                  </div>

                  <div className="space-y-2">
                    <Label>+1日何組増やしたい？</Label>
                    <Input
                      inputMode="numeric"
                      value={String(addGroupsPerDay)}
                      onChange={(e) => setAddGroupsPerDay(numOr0(e.target.value))}
                      placeholder="例：1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>席数</Label>
                    <Input
                      inputMode="numeric"
                      value={String(seats)}
                      onChange={(e) => setSeats(numOr0(e.target.value))}
                      placeholder="例：30"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>広告費（月）</Label>
                    <Input
                      inputMode="numeric"
                      value={String(adSpend)}
                      onChange={(e) => setAdSpend(numOr0(e.target.value))}
                      placeholder="例：100000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>営業日数（月）</Label>
                    <Select value={String(daysPerMonth)} onValueChange={(v) => setDaysPerMonth(Number(v))}>
                      <SelectTrigger>
                        <SelectValue placeholder="26" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OPTIONS.map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {d}日
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">席数から月商（仮説）も出す</Label>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      稼働率×回転数で「席推定の月商」を出します。実売上が分かれば後で上書き。
                    </p>
                  </div>
                  <Switch checked={useBaseline} onCheckedChange={setUseBaseline} />
                </div>

                {useBaseline && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>席稼働率（仮）</Label>
                      <Select value={String(occupancy)} onValueChange={(v) => setOccupancy(Number(v))}>
                        <SelectTrigger>
                          <SelectValue placeholder="0.65" />
                        </SelectTrigger>
                        <SelectContent>
                          {OCCUPANCY_OPTIONS.map((o) => (
                            <SelectItem key={o} value={String(o)}>
                              {Math.round(o * 100)}%
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>回転数（仮）</Label>
                      <Select value={String(turnover)} onValueChange={(v) => setTurnover(Number(v))}>
                        <SelectTrigger>
                          <SelectValue placeholder="2.0" />
                        </SelectTrigger>
                        <SelectContent>
                          {TURNOVER_OPTIONS.map((t) => (
                            <SelectItem key={t} value={String(t)}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <Separator />

                <Tabs defaultValue="preset" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="preset">率（テンプレ）</TabsTrigger>
                    <TabsTrigger value="manual">率（手動）</TabsTrigger>
                  </TabsList>

                  <TabsContent value="preset" className="space-y-3">
                    <div className="rounded-xl border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span>原価率（F）</span>
                        <span className="font-medium">{formatPct(presetRates.food)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>人件費率（L）</span>
                        <span className="font-medium">{formatPct(presetRates.labor)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>家賃率（R）</span>
                        <span className="font-medium">
                          {autoSetRentRate && !manualRates && rentSuggestion.rentRateSuggested > 0
                            ? `${formatPct(rentSuggestion.rentRateSuggested)}（自動）`
                            : formatPct(presetRates.rent)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        ※ F/Lは業態×シナリオの仮説値。Rは（ONなら）住所→係数→家賃推定から自動算出。
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">手動で上書きする</span>
                        <Switch checked={manualRates} onCheckedChange={setManualRates} />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="manual" className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl border p-3">
                      <div>
                        <div className="text-sm font-medium">手動で率を調整</div>
                        <div className="text-xs text-muted-foreground">0.30 = 30%</div>
                      </div>
                      <Switch checked={manualRates} onCheckedChange={setManualRates} />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>原価率（F）</Label>
                        <Input
                          value={String(foodRate)}
                          onChange={(e) => setFoodRate(numOr0(e.target.value))}
                          disabled={!manualRates}
                          placeholder="0.30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>人件費率（L）</Label>
                        <Input
                          value={String(laborRate)}
                          onChange={(e) => setLaborRate(numOr0(e.target.value))}
                          disabled={!manualRates}
                          placeholder="0.30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>家賃率（R）</Label>
                        <Input
                          value={String(rentRate)}
                          onChange={(e) => setRentRate(numOr0(e.target.value))}
                          disabled={!manualRates}
                          placeholder="0.10"
                        />
                      </div>
                    </div>

                    {!manualRates && (
                      <p className="text-xs text-muted-foreground">手動OFFのときは、テンプレ/自動推定が適用されます。</p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                自動計算（結果）
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3">
                <div className="rounded-2xl border p-4">
                  <div className="text-sm text-muted-foreground">増分売上（+{normalized.addG}組/日）</div>
                  <div className="mt-1 text-2xl font-semibold">{formatJPY(normalized.addRevenueMonthly)}/月</div>
                  <div className="mt-1 text-sm text-muted-foreground">{formatJPY(normalized.addRevenueDaily)}/日</div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">増分粗利（原価差引）</div>
                    <div className="mt-1 text-xl font-semibold">{formatJPY(normalized.addGrossProfit)}/月</div>
                    <div className="mt-1 text-xs text-muted-foreground">原価率（F）：{formatPct(normalized.food)}</div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">広告回収ライン（粗利ベース）</div>
                    <div className="mt-1 text-xl font-semibold">{normalized.breakevenGroupsPerDay_Gross.toFixed(2)}組/日</div>
                    <div className="mt-1 text-xs text-muted-foreground">広告費 {formatJPY(adSpend)}/月 を粗利で回収する目安</div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">ROAS（売上/広告）</div>
                    <div className="mt-1 text-xl font-semibold">{normalized.roas.toFixed(2)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">※ 増分売上 ÷ 広告費</div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">粗利ROAS</div>
                    <div className="mt-1 text-xl font-semibold">{normalized.gpRoas.toFixed(2)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">※ 増分粗利 ÷ 広告費</div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-sm text-muted-foreground">FL / FLR</div>
                    <div className="mt-1 text-xl font-semibold">{formatPct(normalized.fl)} / {formatPct(normalized.flr)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">"70%"はFLRで語られることが多い</div>
                  </div>
                </div>

                <Separator />

                <div className="rounded-2xl border p-4">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="space-y-1">
                      <div className="text-sm font-medium">家賃率(R)の根拠（事前仮説）</div>
                      <div className="text-sm text-muted-foreground">
                        {rentSuggestion.areaLabel} / {STATION_DISTANCE[stationDistance].label} / {TRADE_AREA[tradeArea].label}
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-3">
                        <div className="rounded-xl bg-muted/40 p-3">
                          <div className="text-xs text-muted-foreground">推定家賃</div>
                          <div className="font-semibold">{formatJPY(rentSuggestion.estimatedRentMonthly)}/月</div>
                        </div>
                        <div className="rounded-xl 