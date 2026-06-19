export type AqiLevel = "good" | "moderate" | "unhealthy_sensitive" | "unhealthy" | "very_unhealthy" | "hazardous";

export interface AqiClassification {
  level: AqiLevel;
  label: string;
  description: string;
  color: string;
  bgColor: string;
}

const CLASSIFICATIONS: Record<AqiLevel, AqiClassification> = {
  good: {
    level: "good",
    label: "Good",
    description: "Air quality is safe",
    color: "hsl(142.1, 76.2%, 36.3%)",
    bgColor: "hsl(142.1, 76.2%, 36.3%, 0.1)",
  },
  moderate: {
    level: "moderate",
    label: "Moderate",
    description: "Air quality is acceptable",
    color: "hsl(48, 96.5%, 53.9%)",
    bgColor: "hsl(48, 96.5%, 53.9%, 0.1)",
  },
  unhealthy_sensitive: {
    level: "unhealthy_sensitive",
    label: "Unhealthy for Sensitive Groups",
    description: "Sensitive groups should limit outdoor activity",
    color: "hsl(24.6, 95%, 53.1%)",
    bgColor: "hsl(24.6, 95%, 53.1%, 0.1)",
  },
  unhealthy: {
    level: "unhealthy",
    label: "Unhealthy",
    description: "Everyone should limit outdoor activity",
    color: "hsl(0, 72.2%, 50.6%)",
    bgColor: "hsl(0, 72.2%, 50.6%, 0.1)",
  },
  very_unhealthy: {
    level: "very_unhealthy",
    label: "Very Unhealthy",
    description: "Health alert — everyone may experience effects",
    color: "hsl(271, 81.3%, 55.9%)",
    bgColor: "hsl(271, 81.3%, 55.9%, 0.1)",
  },
  hazardous: {
    level: "hazardous",
    label: "Hazardous",
    description: "Health emergency — avoid all outdoor activity",
    color: "hsl(330, 81.3%, 40%)",
    bgColor: "hsl(330, 81.3%, 40%, 0.1)",
  },
};

interface Threshold {
  max: number;
  level: AqiLevel;
}

const PM25_THRESHOLDS: Threshold[] = [
  { max: 12.0, level: "good" },
  { max: 35.4, level: "moderate" },
  { max: 55.4, level: "unhealthy_sensitive" },
  { max: 150.4, level: "unhealthy" },
  { max: 250.4, level: "very_unhealthy" },
  { max: Infinity, level: "hazardous" },
];

const PM10_THRESHOLDS: Threshold[] = [
  { max: 54, level: "good" },
  { max: 154, level: "moderate" },
  { max: 254, level: "unhealthy_sensitive" },
  { max: 354, level: "unhealthy" },
  { max: 424, level: "very_unhealthy" },
  { max: Infinity, level: "hazardous" },
];

const NO2_THRESHOLDS: Threshold[] = [
  { max: 53, level: "good" },
  { max: 100, level: "moderate" },
  { max: 360, level: "unhealthy_sensitive" },
  { max: 649, level: "unhealthy" },
  { max: 1249, level: "very_unhealthy" },
  { max: Infinity, level: "hazardous" },
];

const O3_THRESHOLDS: Threshold[] = [
  { max: 54, level: "good" },
  { max: 70, level: "moderate" },
  { max: 85, level: "unhealthy_sensitive" },
  { max: 105, level: "unhealthy" },
  { max: 200, level: "very_unhealthy" },
  { max: Infinity, level: "hazardous" },
];

function classify(value: number, thresholds: Threshold[]): AqiClassification {
  for (const t of thresholds) {
    if (value <= t.max) {
      return CLASSIFICATIONS[t.level];
    }
  }
  return CLASSIFICATIONS.hazardous;
}

export function classifyPM25(value: number): AqiClassification {
  return classify(value, PM25_THRESHOLDS);
}

export function classifyPM10(value: number): AqiClassification {
  return classify(value, PM10_THRESHOLDS);
}

export function classifyNO2(value: number): AqiClassification {
  return classify(value, NO2_THRESHOLDS);
}

export function classifyO3(value: number): AqiClassification {
  return classify(value, O3_THRESHOLDS);
}

export function classifyPollutant(key: string, value: number): AqiClassification {
  switch (key) {
    case "avg_pm25":
    case "pm2_5":
    case "pm25_prediction":
      return classifyPM25(value);
    case "avg_pm10":
    case "pm10":
    case "pm10_prediction":
      return classifyPM10(value);
    case "avg_no2":
    case "no2":
      return classifyNO2(value);
    case "avg_o3":
    case "o3":
    case "o3_prediction":
      return classifyO3(value);
    default:
      return CLASSIFICATIONS.good;
  }
}
