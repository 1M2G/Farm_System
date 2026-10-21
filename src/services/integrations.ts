export type WeatherSnapshot = {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  rainChance: number;
  source: string;
};

const weatherUrl = import.meta.env.VITE_WEATHER_API_URL;
const weatherKey = import.meta.env.VITE_WEATHER_API_KEY;
const paymentsUrl = import.meta.env.VITE_PAYMENTS_API_URL;

export async function getWeather(latitude: number, longitude: number): Promise<WeatherSnapshot> {
  if (weatherUrl && weatherKey) {
    const response = await fetch(`${weatherUrl}?lat=${latitude}&lon=${longitude}&key=${weatherKey}`);
    if (!response.ok) throw new Error("Weather provider unavailable");
    return response.json();
  }

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=precipitation_probability_max&timezone=Africa%2FNairobi`,
  );
  if (!response.ok) throw new Error("Weather service unavailable");
  const data = await response.json();
  return {
    temperature: Math.round(data.current.temperature_2m),
    condition: data.current.weather_code <= 2 ? "Partly cloudy" : data.current.weather_code <= 48 ? "Cloudy" : "Rain expected",
    humidity: data.current.relative_humidity_2m,
    windSpeed: Math.round(data.current.wind_speed_10m),
    rainChance: data.daily.precipitation_probability_max[0],
    source: "Open-Meteo",
  };
}

export async function initiatePayment(input: {
  provider: string;
  recipient: string;
  amount: number;
  reference: string;
}) {
  if (!paymentsUrl) {
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    return { status: "pending", id: `TX-${Date.now()}`, ...input };
  }
  const response = await fetch(`${paymentsUrl}/transfers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("Transfer gateway unavailable");
  return response.json();
}

export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadPdf(filename: string, title: string, sections: Array<[string, string]>) {
  const escapePdf = (value: string) =>
    value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
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
