export type WeatherSnapshot = {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  rainChance: number;
  source: string;
  observedAt: string;
  hourly: Array<{
    time: string;
    temperature: number;
    rainChance: number;
    precipitation: number;
  }>;
  forecast: Array<{
    date: string;
    minimum: number;
    maximum: number;
    rainChance: number;
    precipitation: number;
  }>;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
    time?: string;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
  };
  daily?: {
    time?: string[];
    temperature_2m_min?: number[];
    temperature_2m_max?: number[];
    precipitation_probability_max?: number[];
    precipitation_sum?: number[];
  };
};

export type BackendHealth = {
  status: "ok" | "degraded" | "not_configured";
  services: { database: "connected" | "unavailable" | "not_configured" };
  message?: string;
};

export type FarmRecord = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFarmRecord(value: unknown): value is FarmRecord {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.created_at === "string"
    && typeof value.updated_at === "string";
}

function weatherCondition(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorms";
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function getWeather(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<WeatherSnapshot> {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("Latitude must be between -90 and 90 degrees.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Longitude must be between -180 and 180 degrees.");
  }

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&hourly=temperature_2m,precipitation_probability,precipitation&daily=temperature_2m_min,temperature_2m_max,precipitation_probability_max,precipitation_sum&forecast_days=7&timezone=Africa%2FKampala`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      throw new Error(`Open-Meteo request failed (${response.status}).`);
    }
    const data = (await response.json()) as OpenMeteoResponse;
    const current = data.current;
    const hourly = data.hourly;
    const daily = data.daily;
    if (
      !current ||
      !hourly ||
      !daily ||
      !isFiniteNumber(current.temperature_2m) ||
      !isFiniteNumber(current.relative_humidity_2m) ||
      !isFiniteNumber(current.wind_speed_10m) ||
      !isFiniteNumber(current.weather_code) ||
      !current.time ||
      !hourly.time?.length ||
      !hourly.temperature_2m ||
      !hourly.precipitation_probability ||
      !hourly.precipitation ||
      !daily.time?.length ||
      !daily.temperature_2m_min ||
      !daily.temperature_2m_max ||
      !daily.precipitation_probability_max ||
      !daily.precipitation_sum ||
      hourly.temperature_2m.length < Math.min(24, hourly.time.length) ||
      hourly.precipitation_probability.length < Math.min(24, hourly.time.length) ||
      hourly.precipitation.length < Math.min(24, hourly.time.length) ||
      daily.temperature_2m_min.length < daily.time.length ||
      daily.temperature_2m_max.length < daily.time.length ||
      daily.precipitation_probability_max.length < daily.time.length ||
      daily.precipitation_sum.length < daily.time.length
    ) {
      throw new Error("Open-Meteo returned incomplete weather data.");
    }

    const hourlyForecast = hourly.time.slice(0, 24).map((time, index) => {
      const temperature = hourly.temperature_2m?.[index];
      const rainChance = hourly.precipitation_probability?.[index];
      const precipitation = hourly.precipitation?.[index];
      if (
        !time ||
        !isFiniteNumber(temperature) ||
        !isFiniteNumber(rainChance) ||
        !isFiniteNumber(precipitation)
      ) {
        throw new Error("Open-Meteo returned invalid hourly forecast data.");
      }
      return { time, temperature, rainChance, precipitation };
    });
    const dailyForecast = daily.time.map((date, index) => {
      const minimum = daily.temperature_2m_min?.[index];
      const maximum = daily.temperature_2m_max?.[index];
      const rainChance = daily.precipitation_probability_max?.[index];
      const precipitation = daily.precipitation_sum?.[index];
      if (
        !date ||
        !isFiniteNumber(minimum) ||
        !isFiniteNumber(maximum) ||
        !isFiniteNumber(rainChance) ||
        !isFiniteNumber(precipitation)
      ) {
        throw new Error("Open-Meteo returned invalid daily forecast data.");
      }
      return { date, minimum, maximum, rainChance, precipitation };
    });

    return {
      temperature: Math.round(current.temperature_2m),
      condition: weatherCondition(current.weather_code),
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m),
      rainChance: dailyForecast[0].rainChance,
      source: "Open-Meteo",
      observedAt: current.time,
      hourly: hourlyForecast,
      forecast: dailyForecast,
    };
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new Error("Weather request timed out after 12 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function initiatePayment(input: {
  provider: string;
  recipient: string;
  amount: number;
  reference: string;
}) {
  if (!input.recipient.trim() || !input.reference.trim() || !Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter a valid recipient, amount, and payment reference.");
  }
  const response = await fetch(`${apiBaseUrl}/payments/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(error?.error || `Payment service rejected the request (${response.status}).`);
  }
  const result = (await response.json()) as { status?: string; id?: string };
  if (!result.id || !result.status) {
    throw new Error("Payment service returned an invalid transaction response.");
  }
  return result;
}

export async function checkBackendHealth(): Promise<BackendHealth> {
  const response = await fetch(`${apiBaseUrl}/health`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const result = (await response.json().catch(() => null)) as BackendHealth | null;
  if (!result || !result.status || !result.services?.database) {
    throw new Error(`Backend health check returned an invalid response (${response.status}).`);
  }
  return result;
}

async function requestFarmApi(accessToken: string, method: "GET" | "POST", name?: string): Promise<FarmRecord[] | FarmRecord> {
  if (!accessToken.trim()) throw new Error("Sign in before accessing farm records.");
  const response = await fetch(`${apiBaseUrl}/farms`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify({ name }) } : {}),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const message = isRecord(result) && typeof result.error === "string"
      ? result.error
      : `Farm service rejected the request (${response.status}).`;
    throw new Error(message);
  }
  if (!isRecord(result)) throw new Error("Farm service returned an invalid response.");

  if (method === "GET") {
    if (!Array.isArray(result.farms) || !result.farms.every(isFarmRecord)) {
      throw new Error("Farm service returned an invalid farm list.");
    }
    return result.farms;
  }
  if (!isFarmRecord(result.farm)) throw new Error("Farm service returned an invalid farm record.");
  return result.farm;
}

export async function getFarmRecords(accessToken: string): Promise<FarmRecord[]> {
  const result = await requestFarmApi(accessToken, "GET");
  if (!Array.isArray(result)) throw new Error("Farm service returned an invalid farm list.");
  return result;
}

export async function createFarmRecord(accessToken: string, name: string): Promise<FarmRecord> {
  const normalizedName = name.trim();
  if (!normalizedName || normalizedName.length > 100) {
    throw new Error("Farm name must contain 1 to 100 characters.");
  }
  const result = await requestFarmApi(accessToken, "POST", normalizedName);
  if (Array.isArray(result)) throw new Error("Farm service returned an invalid farm record.");
  return result;
}

export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadPdf(filename: string, title: string, sections: Array<[string, string]>) {
  const escapePdf = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const wrap = (value: string, limit = 86) => {
    const words = value.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    words.forEach((word) => {
      if (`${line} ${word}`.trim().length > limit) {
        lines.push(line);
        line = word;
      } else {
        line = `${line} ${word}`.trim();
      }
    });
    if (line) lines.push(line);
    return lines;
  };

  const commands: string[] = ["BT", "/F1 18 Tf", "50 790 Td", `(${escapePdf(title)}) Tj`, "/F1 10 Tf"];
  let y = 765;
  sections.forEach(([heading, content]) => {
    if (y < 80) return;
    commands.push(`1 0 0 1 50 ${y} Tm`, "/F1 11 Tf", `(${escapePdf(heading)}) Tj`);
    y -= 16;
    commands.push("/F1 9 Tf");
    wrap(content).forEach((line) => {
      if (y < 60) return;
      commands.push(`1 0 0 1 50 ${y} Tm`, `(${escapePdf(line)}) Tj`);
      y -= 13;
    });
    y -= 8;
  });
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function shareResource(title: string, text: string) {
  if (navigator.share) return navigator.share({ title, text });
  await navigator.clipboard.writeText(text);
}
