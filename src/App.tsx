import { useEffect, useMemo, useState } from "react";
import { downloadCsv, downloadPdf, getWeather, initiatePayment, shareResource, type WeatherSnapshot } from "./services/integrations";

type IconName =
  | "grid"
  | "leaf"
  | "wallet"
  | "chart"
  | "settings"
  | "cloud"
  | "check"
  | "plus"
  | "droplet"
  | "sun"
  | "wind"
  | "more"
  | "arrow"
  | "wifi"
  | "bell"
  | "close";

const iconPaths: Record<IconName, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  leaf: <><path d="M20 4c-7 0-13 3-13 10 0 3 2 5 5 5 7 0 8-9 8-15Z" /><path d="M4 21c2-6 6-9 12-12" /></>,
  wallet: <><path d="M4 7a3 3 0 0 1 3-3h12v16H6a2 2 0 0 1-2-2V7Z" /><path d="M4 8h15" /><path d="M15 13h6v4h-6a2 2 0 0 1 0-4Z" /></>,
  chart: <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  cloud: <><path d="M17 18H6a4 4 0 1 1 1-7.9A6 6 0 0 1 18.8 12 3 3 0 0 1 17 18Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  droplet: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  wind: <><path d="M3 8h11a2 2 0 1 0-2-2" /><path d="M3 12h16a2 2 0 1 1-2 2" /><path d="M3 16h8" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
  arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
  wifi: <><path d="M5 12.5a10 10 0 0 1 14 0" /><path d="M8.5 16a5 5 0 0 1 7 0" /><circle cx="12" cy="20" r="1" fill="currentColor" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path d="M10 21h4" /></>,
  close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

const plots = [
  { name: "North Field", crop: "Maize", stage: "Vegetative", area: "2.4 acres", moisture: 64, health: "Healthy", tone: "lime" },
  { name: "River Plot", crop: "Beans", stage: "Flowering", area: "1.2 acres", moisture: 41, health: "Needs water", tone: "amber" },
  { name: "Home Garden", crop: "Tomatoes", stage: "Fruiting", area: "0.6 acres", moisture: 72, health: "Healthy", tone: "red" },
];

const initialTasks = [
  { id: 1, text: "Inspect beans for aphids", meta: "River Plot · Due today", done: false },
  { id: 2, text: "Record fertilizer purchase", meta: "Farm ledger · Due today", done: false },
  { id: 3, text: "Irrigate tomato beds", meta: "Home Garden · 4:30 PM", done: true },
];


type ModalType = "record" | "field" | "device" | "money" | "report" | null;

type Activity = { id: number; type: string; detail: string; field: string; date: string };
type Transaction = { id: number; kind: "Cash in" | "Cash out"; label: string; amount: number; date: string };

export default function App() {
  const [active, setActive] = useState("Overview");
  const [tasks, setTasks] = useState(initialTasks);
  const [modal, setModal] = useState<ModalType>(null);
  const [toast, setToast] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedField, setSelectedField] = useState(0);
  const [mapLayer, setMapLayer] = useState<"satellite" | "terrain">("satellite");
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showSensors, setShowSensors] = useState(true);
  const [boardEditing, setBoardEditing] = useState(false);
  const [boardZoom, setBoardZoom] = useState(1);
  const [boardOffset, setBoardOffset] = useState({ x: 20, y: 18 });
  const [scanning, setScanning] = useState(false);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { from: "bot", text: "Hello James. I can help with fields, weather, money, devices, and farm records." },
  ]);
  const [paymentProvider, setPaymentProvider] = useState("MTN Mobile Money");
  const [transferPending, setTransferPending] = useState(false);
  const [nearby, setNearby] = useState([
    { id: 101, name: "AgriSense Moisture M2", signal: "Strong", role: "Soil moisture monitoring" },
    { id: 102, name: "LoRa Field Node 7", signal: "Good", role: "Long-range sensor relay" },
    { id: 103, name: "VALLEY-FARM-WIFI", signal: "Strong", role: "Cloud data synchronization" },
  ]);
  const [fields, setFields] = useState(plots);
  const [devices, setDevices] = useState([
    { id: 1, name: "North Field Soil Probe", code: "SP-1042", status: "Connected", battery: "82%", role: "Soil moisture & pH" },
    { id: 2, name: "River Plot Moisture Sensor", code: "MS-2081", status: "Connected", battery: "64%", role: "Irrigation decisions" },
    { id: 3, name: "Farm Gateway", code: "GW-0110", status: "Connected", battery: "Mains", role: "Sensor-to-cloud communication" },
  ]);
  const [activities, setActivities] = useState<Activity[]>([
    { id: 1, type: "Crop activity", detail: "Applied organic fertilizer", field: "North Field", date: "24 Jun" },
    { id: 2, type: "Scouting", detail: "Aphid inspection completed", field: "River Plot", date: "23 Jun" },
    { id: 3, type: "Irrigation", detail: "Tomato beds irrigated", field: "Home Garden", date: "22 Jun" },
  ]);
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: 1, kind: "Cash in", label: "Maize sale", amount: 1800000, date: "22 Jun" },
    { id: 2, kind: "Cash out", label: "Fertilizer", amount: 480000, date: "20 Jun" },
    { id: 3, kind: "Cash out", label: "Field labour", amount: 220000, date: "18 Jun" },
  ]);
  const [reports, setReports] = useState([
    { id: 1, name: "Season 2025A performance", type: "Season summary", updated: "Today" },
    { id: 2, name: "June cash flow", type: "Financial", updated: "Yesterday" },
    { id: 3, name: "Field activity register", type: "Operations", updated: "21 Jun" },
  ]);
  const [selectedReportId, setSelectedReportId] = useState(1);
  const [reportEditMode, setReportEditMode] = useState(false);
  const [reportNotes, setReportNotes] = useState<Record<number, string>>({
    1: "Season performance remains positive. Continue weekly scouting and protect the planned spraying window.",
    2: "Cash position is healthy, but input costs should be reviewed before the next procurement cycle.",
    3: "Field activity capture is consistent. River Plot requires additional moisture monitoring.",
  });
  const completed = useMemo(() => tasks.filter((task) => task.done).length, [tasks]);
  const balance = useMemo(() => transactions.reduce((sum, t) => sum + (t.kind === "Cash in" ? t.amount : -t.amount), 0), [transactions]);
  const reportSnapshot = useMemo(() => {
    const cashIn = transactions.filter((item) => item.kind === "Cash in").reduce((sum, item) => sum + item.amount, 0);
    const cashOut = transactions.filter((item) => item.kind === "Cash out").reduce((sum, item) => sum + item.amount, 0);
    const averageMoisture = fields.length ? Math.round(fields.reduce((sum, field) => sum + field.moisture, 0) / fields.length) : 0;
    const connectedDevices = devices.filter((device) => device.status === "Connected").length;
    return {
      cashIn,
      cashOut,
      netCash: cashIn - cashOut,
      averageMoisture,
      connectedDevices,
      activityCount: activities.length,
      healthyFields: fields.filter((field) => field.health === "Healthy").length,
      rainChance: weather?.rainChance ?? 0,
      generatedAt: new Date().toLocaleString("en-UG", { dateStyle: "medium", timeStyle: "short" }),
    };
  }, [activities, devices, fields, transactions, weather]);
  const money = (value: number) => `UGX ${new Intl.NumberFormat("en-UG", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2600); };
  const go = (page: string) => { setActive(page); setNotificationsOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  useEffect(() => {
    getWeather(0.7025, 32.8886)
      .then(setWeather)
      .catch(() => setWeatherError(true));
  }, []);

  const askAssistant = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = chatInput.trim();
    if (!question) return;
    const lower = question.toLowerCase();
    let answer = "I can open the relevant workspace or explain your current farm information.";
    if (lower.includes("weather") || lower.includes("rain")) answer = `Current conditions are ${weather?.temperature ?? 27}° with ${weather?.rainChance ?? 85}% rain probability. Review the Weather Advisory before spraying.`;
    else if (lower.includes("money") || lower.includes("balance")) answer = `Your farm wallet balance is ${money(balance)}. Open Money to review transfers and cash flow.`;
    else if (lower.includes("field") || lower.includes("crop")) answer = `${fields.length} fields are active. River Plot currently needs the most attention because moisture is low.`;
    else if (lower.includes("device") || lower.includes("sensor")) answer = `${devices.length} devices are connected and communicating. Open Devices & Sensors to test or assign roles.`;
    else if (lower.includes("report")) answer = "Reports can be downloaded as CSV or shared directly from the Reports workspace.";
    setChatMessages([...chatMessages, { from: "user", text: question }, { from: "bot", text: answer }]);
    setChatInput("");
  };

  const nav = [["Overview", "grid"], ["My fields", "leaf"], ["Money", "wallet"], ["Reports", "chart"]] as [string, IconName][];

  const submitModal = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (modal === "field") setFields([...fields, { name: String(data.get("name")), crop: String(data.get("crop")), stage: "Planning", area: String(data.get("area")), moisture: 0, health: "Setup needed", tone: "lime" }]);
    if (modal === "device") setDevices([...devices, { id: Date.now(), name: String(data.get("name")), code: String(data.get("code")), status: "Connecting", battery: "—", role: String(data.get("role")) }]);
    if (modal === "money") setTransactions([{ id: Date.now(), kind: String(data.get("kind")) as "Cash in" | "Cash out", label: String(data.get("label")), amount: Number(data.get("amount")), date: "Today" }, ...transactions]);
    if (modal === "report") setReports([{ id: Date.now(), name: String(data.get("name")), type: String(data.get("type")), updated: "Just now" }, ...reports]);
    if (modal === "record") setActivities([{ id: Date.now(), type: String(data.get("type")), field: String(data.get("field")), detail: String(data.get("detail")), date: "Today" }, ...activities]);
    notify(`${modal?.[0].toUpperCase()}${modal?.slice(1)} saved successfully`); setModal(null);
  };

  const PageTitle = ({ eyebrow, title, text, action, onAction }: { eyebrow: string; title: string; text: string; action?: string; onAction?: () => void }) => <div className="page-title"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{text}</p></div>{action && <button className="primary" onClick={onAction}>{action}</button>}</div>;

  const Overview = () => <>
    <div className="welcome-row"><div><p className="eyebrow">MONDAY, 24 JUNE</p><h1>Good morning, James.</h1><p>Your farm is healthy. Two actions need attention today.</p></div><div className="season"><span>Season 2025A</span><strong>Day 46 of 120</strong><div><i /></div></div></div>
    <button className="alert-strip full-button" onClick={() => go("Advisory")}><span className="alert-icon"><Icon name="cloud" /></span><div><strong>Rain expected tomorrow afternoon</strong><p>Delay spraying on North Field. Open the advisory for a recommended action plan.</p></div><span className="review-link">Review advisory <Icon name="arrow" size={17} /></span></button>
    <div className="metric-grid"><div className="metric-card blue"><small>Expected yield</small><strong>8.4 tonnes</strong><span>↑ 12% forecast</span></div><div className="metric-card"><small>Available cash</small><strong>{money(balance)}</strong><span>3 recent entries</span></div><div className="metric-card"><small>Active fields</small><strong>{fields.length}</strong><span>{fields.reduce((a, f) => a + parseFloat(f.area), 0).toFixed(1)} acres tracked</span></div><div className="metric-card"><small>Tasks completed</small><strong>{completed}/{tasks.length}</strong><span>Keep the team moving</span></div></div>
    <div className="overview-grid"><section className="card chart-card"><div className="card-head"><div><p className="eyebrow">FARM PULSE</p><h2>Weekly activity</h2></div><span className="status good">Live</span></div><div className="visual-chart">{[42,68,55,82,63,91,74].map((h,i)=><div key={i}><i style={{height:`${h}%`}}/><span>{["M","T","W","T","F","S","S"][i]}</span></div>)}</div><div className="chart-legend"><span><i className="dot blue-dot"/>Recorded work</span><span><i className="dot pale-dot"/>Previous week</span></div></section><section className="card"><div className="card-head"><div><p className="eyebrow">TODAY</p><h2>Action list</h2></div><span className="task-count">{completed}/{tasks.length} done</span></div><div className="task-list">{tasks.map(task=><label className={`task ${task.done?"done":""}`} key={task.id}><input type="checkbox" checked={task.done} onChange={()=>setTasks(tasks.map(t=>t.id===task.id?{...t,done:!t.done}:t))}/><span className="fake-check"><Icon name="check" size={15}/></span><span><strong>{task.text}</strong><small>{task.meta}</small></span></label>)}</div></section></div>
    <div className="dashboard-grid lower"><section className="card fields-card"><div className="card-head"><div><p className="eyebrow">FIELD STATUS</p><h2>Crop health overview</h2></div><button className="text-button" onClick={()=>go("My fields")}>Manage fields <Icon name="arrow" size={17}/></button></div><div className="plot-list">{fields.slice(0,3).map(plot=><button className="plot-row" key={plot.name} onClick={()=>go("My fields")}><span className="plot-main"><strong>{plot.name}</strong><small>{plot.crop} · {plot.stage}</small></span><span className="plot-area"><small>Area</small><strong>{plot.area}</strong></span><span className="moisture"><small>Moisture</small><span><i style={{width:`${plot.moisture}%`}}/></span><strong>{plot.moisture}%</strong></span><span className={`status ${plot.health==="Healthy"?"good":"warning"}`}>{plot.health}</span></button>)}</div></section><section className="card weather-card"><div className="card-head"><div><p className="eyebrow">KAYUNGA · LIVE API</p><h2>Field conditions</h2></div><span className="api-live">{weatherError?"Offline":"Live"}</span></div><div className="temp-row"><strong>{weather?.temperature ?? 27}°</strong><div><span>{weather?.condition ?? "Loading conditions…"}</span><small>{weather?.rainChance ?? 0}% chance of rain · {weather?.source ?? "Weather API"}</small></div></div><div className="weather-stats"><div><Icon name="droplet"/><span><small>Humidity</small><strong>{weather?.humidity ?? 74}%</strong></span></div><div><Icon name="wind"/><span><small>Wind</small><strong>{weather?.windSpeed ?? 8} km/h</strong></span></div></div><button className="weather-action" onClick={()=>go("Advisory")}>Open detailed weather advisory</button></section></div>
  </>;

  const Fields = () => {
    const field = fields[selectedField] || fields[0];
    const updateSelectedField = () => {
      const crop = window.prompt("Primary crop", field.crop);
      const area = window.prompt("Field area", field.area);
      if (!crop || !area) return;
      setFields(fields.map((item, index) => index === selectedField ? { ...item, crop, area } : item));
      notify("Field design details updated");
    };
    return <>
      <PageTitle eyebrow="FARM OPERATIONS" title="My fields" text="Use the architectural board to inspect, layer, and edit one field at a time." action="Add field" onAction={() => setModal("field")} />
      <div className="field-selector">{fields.map((item, index) => <button className={selectedField === index ? "active" : ""} key={item.name} onClick={() => setSelectedField(index)}><strong>{item.name}</strong><span>{item.crop} · {item.area}</span></button>)}</div>
      <div className="map-integration">
        <iframe title="Green Valley Farm map" src={`https://maps.google.com/maps?q=Kayunga%20Uganda&t=${mapLayer === "satellite" ? "k" : "p"}&z=15&output=embed`} loading="lazy" />
        <div className="map-api-label"><strong>Google Maps integration</strong><span>{mapLayer === "satellite" ? "Satellite imagery" : "Terrain map"} · Kayunga, Uganda</span><a href="https://maps.google.com/?q=Kayunga+Uganda" target="_blank" rel="noreferrer">Open in Google Maps</a></div>
      </div>
      <div className={`satellite-stage ${mapLayer} ${boardEditing ? "editing" : ""}`}>
        <div className="sat-grid" /><div className="sat-road road-one" /><div className="sat-road road-two" /><div className="water-line" />
        <div className={`selected-boundary ${showBoundaries ? "" : "boundary-hidden"}`} style={{ left: `${boardOffset.x}%`, top: `${boardOffset.y}%`, scale: String(boardZoom) }}>
          {showBoundaries && <><span className="corner c1" /><span className="corner c2" /><span className="corner c3" /><span className="corner c4" /></>}
          <div className="field-crops">{Array.from({ length: 12 }).map((_, index) => <i key={index} />)}</div>
          <div className="field-pin"><strong>{field.name}</strong><span>{field.crop} · {field.area}</span></div>
          {showSensors && <><button className="sensor-point sensor-a" onClick={() => notify(`North sensor: ${field.moisture}% moisture`)}>S1</button><button className="sensor-point sensor-b" onClick={() => notify("Weather station: reporting normally")}>W</button></>}
        </div>
        <div className="map-tools">
          <button className={mapLayer === "satellite" ? "active" : ""} onClick={() => setMapLayer(mapLayer === "satellite" ? "terrain" : "satellite")}>{mapLayer === "satellite" ? "Satellite" : "Terrain"}</button>
          <button className={showBoundaries ? "active" : ""} onClick={() => setShowBoundaries(!showBoundaries)}>Boundaries</button>
          <button className={showSensors ? "active" : ""} onClick={() => setShowSensors(!showSensors)}>Sensors</button>
        </div>
        <div className="board-editor">
          <div><strong>Design board</strong><span>{boardEditing ? "Editing enabled" : "View mode"}</span></div>
          <button className={boardEditing ? "active" : ""} onClick={() => setBoardEditing(!boardEditing)}>{boardEditing ? "Finish editing" : "Edit layout"}</button>
          {boardEditing && <div className="editor-controls">
            <button aria-label="Move field left" onClick={() => setBoardOffset({ ...boardOffset, x: Math.max(2, boardOffset.x - 2) })}>←</button>
            <button aria-label="Move field up" onClick={() => setBoardOffset({ ...boardOffset, y: Math.max(2, boardOffset.y - 2) })}>↑</button>
            <button aria-label="Move field down" onClick={() => setBoardOffset({ ...boardOffset, y: Math.min(40, boardOffset.y + 2) })}>↓</button>
            <button aria-label="Move field right" onClick={() => setBoardOffset({ ...boardOffset, x: Math.min(45, boardOffset.x + 2) })}>→</button>
            <button onClick={() => setBoardZoom(Math.max(.75, boardZoom - .1))}>−</button>
            <button onClick={() => setBoardZoom(Math.min(1.3, boardZoom + .1))}>+</button>
            <button className="details-button" onClick={updateSelectedField}>Edit details</button>
          </div>}
        </div>
        <div className="map-scale">50 m</div>
      </div>
      <div className="field-detail-head"><div><p className="eyebrow">SELECTED FIELD</p><h2>{field.name}</h2><p>{field.crop} · {field.stage} · {field.area}</p></div><span className={`status ${field.health === "Healthy" ? "good" : "warning"}`}>{field.health}</span></div>
      <div className="field-stat-grid"><div><small>Soil moisture</small><strong>{field.moisture}%</strong><span>Live sensor reading</span></div><div><small>Current operation</small><strong>{field.stage}</strong><span>Day 46 of season</span></div><div><small>Next action</small><strong>{field.health === "Healthy" ? "Routine scouting" : "Irrigation"}</strong><span>Scheduled tomorrow</span></div><div><small>Connected role</small><strong>Crop production</strong><span>Yield and activity tracking</span></div></div>
      <section className="card field-timeline"><div className="card-head"><div><p className="eyebrow">{field.name.toUpperCase()}</p><h2>Operational timeline</h2></div></div>{activities.filter((activity) => activity.field === field.name).map((activity) => <div className="timeline-row" key={activity.id}><i /><div><strong>{activity.detail}</strong><span>{activity.type}</span></div><small>{activity.date}</small></div>)}{!activities.some((activity) => activity.field === field.name) && <p className="empty-state">No activity recorded for this field yet.</p>}</section>
    </>;
  };

  const Money = () => <><PageTitle eyebrow="FINANCE" title="Money & wallet" text="Monitor cash flow, protect working capital, and record every movement." action="Add cash entry" onAction={()=>setModal("money")}/><div className="wallet-hero"><div><small>AVAILABLE FARM WALLET</small><strong>{money(balance)}</strong><span>Updated from {transactions.length} entries</span></div><div className="wallet-actions"><button onClick={()=>setModal("money")}>Record cash in</button><button onClick={()=>setModal("money")}>Record cash out</button></div></div><div className="metric-grid three"><div className="metric-card"><small>Cash in</small><strong>{money(transactions.filter(t=>t.kind==="Cash in").reduce((a,t)=>a+t.amount,0))}</strong><span className="positive">Income this period</span></div><div className="metric-card"><small>Cash out</small><strong>{money(transactions.filter(t=>t.kind==="Cash out").reduce((a,t)=>a+t.amount,0))}</strong><span>Inputs and operations</span></div><div className="metric-card action-card"><small>Recommended action</small><strong>Review input budget</strong><button onClick={()=>notify("Budget review added to your tasks")}>Add to tasks</button></div></div><section className="card payment-gateway"><div className="card-head"><div><p className="eyebrow">TRANSFER GATEWAY</p><h2>Send farm payments</h2></div><span className="api-live">Secure connection</span></div><div className="provider-tabs">{["MTN Mobile Money","Airtel Money","Bank transfer"].map(provider=><button className={paymentProvider===provider?"active":""} onClick={()=>setPaymentProvider(provider)} key={provider}>{provider}</button>)}</div><form onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget);setTransferPending(true);try{const result=await initiatePayment({provider:paymentProvider,recipient:String(data.get("recipient")),amount:Number(data.get("amount")),reference:String(data.get("reference"))});notify(`Transfer ${result.status}: ${result.id}`)}catch{notify("Transfer could not be started")}finally{setTransferPending(false)}}}><label>Recipient<input name="recipient" required placeholder={paymentProvider==="Bank transfer"?"Account number":"Mobile number"}/></label><label>Amount (UGX)<input name="amount" type="number" min="500" required/></label><label>Reference<input name="reference" required placeholder="e.g. Seed supplier"/></label><button className="primary" disabled={transferPending}>{transferPending?"Connecting…":`Continue with ${paymentProvider}`}</button></form><div className="gateway-note">Gateway interface ready for provider credentials and transaction webhooks.</div></section><section className="card"><div className="card-head"><div><p className="eyebrow">WALLET ACTIVITY</p><h2>Cash movements</h2></div><div className="export-actions"><button onClick={()=>downloadCsv("my-farm-transactions.csv",[["Type","Description","Amount","Date"],...transactions.map(t=>[t.kind,t.label,t.amount,t.date])])}>Download</button><button onClick={()=>shareResource("My Farm cash flow",`Current farm wallet balance: ${money(balance)}`).then(()=>notify("Financial summary shared or copied"))}>Share</button><button onClick={()=>setModal("money")}>New entry</button></div></div>{transactions.map(t=><div className="transaction-row" key={t.id}><span className={t.kind==="Cash in"?"cash-in":"cash-out"}>{t.kind==="Cash in"?"IN":"OUT"}</span><div><strong>{t.label}</strong><small>{t.date} · {t.kind}</small></div><strong className={t.kind==="Cash in"?"positive":""}>{t.kind==="Cash in"?"+":"−"}{money(t.amount)}</strong><button className="text-button danger" onClick={()=>setTransactions(transactions.filter(x=>x.id!==t.id))}>Delete</button></div>)}</section></>;

  const Reports = () => {
    const selectedReport = reports.find((report) => report.id === selectedReportId) || reports[0];
    const exportReport = () => downloadPdf(`${selectedReport.name}.pdf`, selectedReport.name, [
      ["Report details", `${selectedReport.type}. Generated ${reportSnapshot.generatedAt}. Data sources: system records, sensors, wallet and weather API.`],
      ["Operational summary", `${reportSnapshot.activityCount} activities captured. ${reportSnapshot.healthyFields} of ${fields.length} fields are healthy. Average soil moisture is ${reportSnapshot.averageMoisture}%.`],
      ["Sensor and device coverage", `${reportSnapshot.connectedDevices} of ${devices.length} registered devices are connected and communicating.`],
      ["Weather analysis", `Current rain probability is ${reportSnapshot.rainChance}%. Temperature is ${weather?.temperature ?? 27} degrees Celsius.`],
      ["Financial position", `Cash in: ${money(reportSnapshot.cashIn)}. Cash out: ${money(reportSnapshot.cashOut)}. Net cash: ${money(reportSnapshot.netCash)}.`],
      ["Management interpretation", reportNotes[selectedReport.id] || "No management interpretation added."],
    ]);
    return <>
      <PageTitle eyebrow="AUTOMATED INTELLIGENCE" title="Coordinated farm reports" text="Reports update automatically from farm entries, financial activity, sensors, devices, and external weather data." />
      <div className="report-source-strip"><div><i /><span><strong>Reporting engine is live</strong><small>Last coordinated: {reportSnapshot.generatedAt}</small></span></div><button type="button" onClick={() => notify("Reports refreshed from every connected source")}>Refresh all sources</button></div>
      <div className="source-grid">
        <div><span className="source-status" /><strong>Farm records</strong><b>{reportSnapshot.activityCount} entries</b><small>Activities and operations</small></div>
        <div><span className="source-status" /><strong>Sensor network</strong><b>{reportSnapshot.connectedDevices}/{devices.length} live</b><small>{reportSnapshot.averageMoisture}% average moisture</small></div>
        <div><span className="source-status" /><strong>Weather API</strong><b>{weather?.temperature ?? 27}°C</b><small>{reportSnapshot.rainChance}% rain probability</small></div>
        <div><span className="source-status" /><strong>Farm wallet</strong><b>{money(reportSnapshot.netCash)}</b><small>Net recorded cash</small></div>
      </div>
      <div className="report-workspace">
        <aside className="card report-index"><div className="card-head"><div><p className="eyebrow">REPORT REGISTER</p><h2>Available reports</h2></div></div>{reports.map((report) => <button type="button" className={selectedReport?.id === report.id ? "active" : ""} key={report.id} onClick={() => { setSelectedReportId(report.id); setReportEditMode(false); }}><span><strong>{report.name}</strong><small>{report.type} · Auto-updated {report.updated}</small></span><b>Open</b></button>)}</aside>
        {selectedReport && <section className="report-document">
          <header><div><p>MY FARM · COORDINATED REPORT</p>{reportEditMode ? <div className="report-title-editor"><input aria-label="Report title" value={selectedReport.name} onChange={(event) => setReports(reports.map((report) => report.id === selectedReport.id ? { ...report, name: event.target.value, updated: "Just now" } : report))} /><select aria-label="Report type" value={selectedReport.type} onChange={(event) => setReports(reports.map((report) => report.id === selectedReport.id ? { ...report, type: event.target.value, updated: "Just now" } : report))}><option>Season summary</option><option>Financial</option><option>Operations</option><option>Custom farm report</option></select></div> : <><h2>{selectedReport.name}</h2><span>{selectedReport.type} · Generated {reportSnapshot.generatedAt}</span></>}</div><div className="report-controls"><button type="button" className={reportEditMode ? "editing" : ""} onClick={() => { setReportEditMode(!reportEditMode); if (reportEditMode) notify("Report edits saved"); }}>{reportEditMode ? "Save report" : "Edit report"}</button><button type="button" onClick={exportReport}>Download</button><button type="button" onClick={() => shareResource(selectedReport.name, `${selectedReport.name}: ${reportNotes[selectedReport.id] || "Automated farm report"}`).then(() => notify("Report shared or copied"))}>Share</button></div></header>
          <div className="report-summary"><div><small>Operations captured</small><strong>{reportSnapshot.activityCount}</strong><span>System records</span></div><div><small>Field health</small><strong>{reportSnapshot.healthyFields}/{fields.length}</strong><span>Healthy fields</span></div><div><small>Sensor coverage</small><strong>{reportSnapshot.connectedDevices}/{devices.length}</strong><span>Communicating</span></div><div><small>Net farm cash</small><strong>{money(reportSnapshot.netCash)}</strong><span>Wallet records</span></div></div>
          <div className={`report-section ${reportEditMode ? "content-editing" : ""}`} contentEditable={reportEditMode} suppressContentEditableWarning><div><p className="eyebrow">AUTOMATED FINDINGS</p><h3>Operational and external data analysis</h3></div><div className="finding-grid"><article><strong>Field operations</strong><p>{reportSnapshot.activityCount} activities were captured. {reportSnapshot.healthyFields} fields are healthy, with average soil moisture at {reportSnapshot.averageMoisture}%.</p><span>Source: Farm records + field sensors</span></article><article><strong>Weather impact</strong><p>Current rain probability is {reportSnapshot.rainChance}%. {reportSnapshot.rainChance > 60 ? "Weather-sensitive work should be reviewed before deployment." : "Conditions remain suitable for planned field work."}</p><span>Source: Live weather API</span></article><article><strong>Financial position</strong><p>Recorded cash in is {money(reportSnapshot.cashIn)} and cash out is {money(reportSnapshot.cashOut)}, resulting in {money(reportSnapshot.netCash)} net cash.</p><span>Source: Farm wallet and transactions</span></article><article><strong>Connectivity</strong><p>{reportSnapshot.connectedDevices} of {devices.length} registered devices are connected and sending operational telemetry.</p><span>Source: Device connection centre</span></article></div></div>
          <div className="report-editor"><div><p className="eyebrow">MANAGEMENT INTERPRETATION</p><h3>Edit report narrative</h3><span>Automatic figures remain synchronized while your notes can be edited.</span></div><textarea value={reportNotes[selectedReport.id] || ""} onChange={(event) => setReportNotes({ ...reportNotes, [selectedReport.id]: event.target.value })} rows={5} /><div className="report-editor-actions"><span>Changes are kept in this report.</span><button type="button" onClick={() => notify("Report narrative saved")}>Save interpretation</button></div></div>
          <footer><span>Data sources: field records, wallet, sensor gateway, Open-Meteo weather API</span><button type="button" className="danger" onClick={() => { setReports(reports.filter((report) => report.id !== selectedReport.id)); setSelectedReportId(reports.find((report) => report.id !== selectedReport.id)?.id || 0); }}>Delete report</button></footer>
        </section>}
      </div>
    </>;
  };

  const Advisory = () => <><PageTitle eyebrow="WEATHER ADVISORY" title="Rain expected tomorrow" text="A practical action plan based on your field activities and local forecast."/><div className="advisory-hero"><div><span>Tomorrow · 2 PM–7 PM</span><strong>85% chance of rain</strong><p>12–18 mm expected across Kayunga District.</p></div><Icon name="cloud" size={64}/></div><div className="two-col"><section className="card"><p className="eyebrow">RECOMMENDED ACTION</p><h2>Delay spraying North Field</h2><p className="body-copy">Rain may wash off treatment before it is absorbed. Reschedule spraying for Thursday morning when wind and rainfall risk are low.</p><div className="advice-steps"><span><b>Today</b>Inspect maize and prepare equipment.</span><span><b>Tomorrow</b>Pause spraying and check drainage channels.</span><span><b>Thursday</b>Spray between 7–10 AM.</span></div><button className="primary" onClick={()=>{setTasks([{id:Date.now(),text:"Spray North Field",meta:"North Field · Thursday, 7:00 AM",done:false},...tasks]);notify("Recommended action added to tasks")}}>Add action to farm tasks</button></section><section className="card"><p className="eyebrow">FIELDS AFFECTED</p><h2>Operational impact</h2><div className="impact-row"><strong>North Field</strong><span className="status warning">Reschedule spray</span></div><div className="impact-row"><strong>River Plot</strong><span className="status good">Rain beneficial</span></div><div className="impact-row"><strong>Home Garden</strong><span className="status good">No action needed</span></div></section></div></>;

  const Devices = () => { const scan=()=>{setScanning(true);setTimeout(()=>{setScanning(false);notify("Scan complete: 3 available connections found")},1500)}; return <><PageTitle eyebrow="CONNECTION CENTRE" title="Devices & sensors" text="Discover nearby networks and sensors, assign each a role, and monitor farm-wide communication."/><div className="communication-hero"><div className="pulse-core"><i/><span>LIVE</span></div><div><strong>All systems communicating</strong><p>{devices.length} devices connected · Cloud sync current · 0 failed messages</p></div><div className="comm-metrics"><span><b>99.8%</b> Uptime</span><span><b>12 sec</b> Last reading</span><span><b>Strong</b> Gateway</span></div></div><div className="device-layout"><section className="card discovery-card"><div className="card-head"><div><p className="eyebrow">DISCOVERY</p><h2>Available connections</h2></div><button className="primary" onClick={scan}>{scanning?"Scanning…":"Scan nearby"}</button></div>{scanning&&<div className="scan-wave"><i/><i/><i/><span>Searching Bluetooth, Wi-Fi and LoRaWAN…</span></div>}{!scanning&&nearby.map(n=><div className="network-row" key={n.id}><span className="signal-bars"><i/><i/><i/></span><div><strong>{n.name}</strong><small>{n.role} · {n.signal} signal</small></div><button className="secondary" onClick={()=>{setDevices([...devices,{id:n.id,name:n.name,code:`AUTO-${n.id}`,status:"Connected",battery:"New",role:n.role}]);setNearby(nearby.filter(x=>x.id!==n.id));notify(`${n.name} connected and assigned`)}}>Connect</button></div>)}</section><section className="card connection-map"><p className="eyebrow">COMMUNICATION MAP</p><h2>How farm data flows</h2><div className="flow-diagram"><div className="flow-node sensors-node"><strong>Sensors</strong><span>Field readings</span></div><i className="flow-line l1"/><div className="flow-node gateway-node"><strong>Gateway</strong><span>Collects & relays</span></div><i className="flow-line l2"/><div className="flow-node cloud-node"><strong>My Farm Cloud</strong><span>Syncs records</span></div></div></section></div><section className="card"><div className="card-head"><div><p className="eyebrow">CONNECTED & SYNCING</p><h2>Managed connections</h2></div><button className="secondary" onClick={()=>notify("Every connection responded successfully")}>Test all</button></div>{devices.map(d=><div className="device-row" key={d.id}><span className="live-indicator"><i/></span><div><strong>{d.name}</strong><small>{d.code} · Battery {d.battery}</small><em>Role: {d.role}</em></div><span className="data-stream"><i/><i/><i/><b>Sending data</b></span><span className="status good">{d.status}</span><button className="secondary" onClick={()=>notify(`${d.name}: connection healthy, role is ${d.role}`)}>Manage</button><button className="text-button danger" onClick={()=>setDevices(devices.filter(x=>x.id!==d.id))}>Disconnect</button></div>)}</section></> };

  const Settings = () => <><PageTitle eyebrow="FARM SETUP" title="Settings" text="Configure fields, record types, alerts, and your farm workspace."/><div className="settings-grid"><section className="card"><p className="eyebrow">FIELD CONFIGURATION</p><h2>Farm structure</h2><p className="body-copy">Manage the plots available when recording work.</p>{fields.map(f=><div className="setting-row" key={f.name}><span><strong>{f.name}</strong><small>{f.crop} · {f.area}</small></span><button className="text-button" onClick={()=>notify(`${f.name} settings opened`)}>Edit</button></div>)}<button className="secondary full" onClick={()=>setModal("field")}>Add another field</button></section><section className="card"><p className="eyebrow">RECORD TYPES</p><h2>Data collection</h2><p className="body-copy">Choose the entries your team can create.</p>{["Crop activity","Farm expense","Harvest","Sale","Scouting note"].map((name,i)=><label className="toggle-row" key={name}><span>{name}</span><input type="checkbox" defaultChecked={i<4}/><i/></label>)}</section><section className="card"><p className="eyebrow">ACCOUNT</p><h2>Profile & access</h2><p className="body-copy">Update farmer details, contact information, and preferences.</p><button className="primary full" onClick={()=>go("Profile")}>Open full profile</button></section><section className="card"><p className="eyebrow">DEVICES</p><h2>Sync configuration</h2><p className="body-copy">Manage {devices.length} connected gateways and sensors.</p><button className="secondary full" onClick={()=>go("Devices")}>Manage devices & sensors</button></section></div></>;

  const Profile = () => <><PageTitle eyebrow="ACCOUNT" title="Farmer profile" text="Your complete identity, farm information, and communication preferences."/><div className="profile-page"><aside className="card profile-summary"><span className="large-avatar">JM</span><h2>James Mugisha</h2><p>Farm owner · Green Valley Farm</p><span className="status good">Verified profile</span></aside><form className="card profile-form" onSubmit={e=>{e.preventDefault();notify("Profile changes saved")}}><div className="form-section"><h2>Personal information</h2><div className="form-grid"><label>Full name<input defaultValue="James Mugisha"/></label><label>Phone number<input defaultValue="+256 772 000 245"/></label><label>Email address<input defaultValue="james@greenvalley.ug"/></label><label>Preferred language<select defaultValue="English"><option>English</option><option>Luganda</option></select></label></div></div><div className="form-section"><h2>Farm details</h2><div className="form-grid"><label>Farm name<input defaultValue="Green Valley Farm"/></label><label>District<input defaultValue="Kayunga"/></label><label>Village<input defaultValue="Kangulumira"/></label><label>Primary activity<select defaultValue="Crop farming"><option>Crop farming</option><option>Mixed farming</option></select></label></div></div><div className="form-actions"><button className="primary" type="submit">Save profile changes</button></div></form></div></>;

  const pages: Record<string, React.ReactNode> = { Overview:<Overview/>, "My fields":<Fields/>, Money:<Money/>, Reports:<Reports/>, Advisory:<Advisory/>, Devices:<Devices/>, Settings:<Settings/>, Profile:<Profile/> };

  return <div className="app-shell"><aside className="sidebar"><button className="brand brand-button" onClick={()=>go("Overview")}><span className="brand-mark">MF</span><span>My Farm</span></button><nav className="nav-list">{nav.map(([label,icon])=><button className={`nav-item ${active===label?"active":""}`} onClick={()=>go(label)} key={label}><Icon name={icon}/><span>{label}</span></button>)}</nav><div className="sidebar-bottom"><button className="sync-card sync-button" onClick={()=>go("Devices")}><span className="sync-icon"><Icon name="wifi"/></span><div><strong>All records synced</strong><small>Manage devices & sensors</small></div></button><button className={`nav-item ${active==="Settings"?"active":""}`} onClick={()=>go("Settings")}><Icon name="settings"/><span>Settings</span></button><button className="profile profile-button" onClick={()=>go("Profile")}><span>JM</span><div><strong>James Mugisha</strong><small>View full profile</small></div><Icon name="arrow"/></button></div></aside><main><header className="topbar"><div className="mobile-brand"><span className="brand-mark">MF</span><strong>My Farm</strong></div><div className="connection"><i/><span>Online</span><small>Last synced just now</small></div><div className="notification-wrap"><button className="icon-button" aria-label="Notifications" onClick={()=>setNotificationsOpen(!notificationsOpen)}><Icon name="bell"/><b>3</b></button>{notificationsOpen&&<div className="notification-panel"><div className="card-head"><h2>Notifications</h2><button className="text-button" onClick={()=>notify("All notifications marked as read")}>Mark all read</button></div><button onClick={()=>go("Advisory")}><i className="notice warning-notice"/><span><strong>Weather action needed</strong><small>Rain affects tomorrow's spraying plan.</small></span></button><button onClick={()=>go("Devices")}><i className="notice"/><span><strong>Gateway signal is weak</strong><small>Check the Farm Gateway connection.</small></span></button><button onClick={()=>go("Money")}><i className="notice"/><span><strong>Expense review due</strong><small>Input spending is 8% above plan.</small></span></button></div>}</div>{active==="Overview"&&<button className="primary small" onClick={()=>setModal("record")}><Icon name="plus" size={18}/> Add record</button>}</header><section className="content">{pages[active]}</section></main><nav className="mobile-nav">{nav.map(([label,icon])=><button className={active===label?"active":""} onClick={()=>go(label)} key={label}><Icon name={icon}/><span>{label}</span></button>)}</nav>{modal&&<div className="modal-backdrop" onMouseDown={()=>setModal(null)}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">QUICK ENTRY</p><h2>Add {modal}</h2></div><button className="icon-button" onClick={()=>setModal(null)}><Icon name="close"/></button></div><form onSubmit={submitModal}>{modal==="field"&&<><label>Field name<input name="name" required placeholder="e.g. East Plot"/></label><label>Primary crop<input name="crop" required placeholder="e.g. Coffee"/></label><label>Area<input name="area" required placeholder="e.g. 1.5 acres"/></label></>}{modal==="device"&&<><label>Device name<input name="name" required placeholder="e.g. East Plot Soil Probe"/></label><label>Device code<input name="code" required placeholder="Printed on the device"/></label><label>Service role<select name="role"><option>Soil moisture monitoring</option><option>Weather monitoring</option><option>Irrigation control</option><option>Cloud data synchronization</option></select></label></>}{modal==="money"&&<><label>Movement<select name="kind"><option>Cash in</option><option>Cash out</option></select></label><label>Description<input name="label" required placeholder="What was this for?"/></label><label>Amount (UGX)<input name="amount" type="number" min="1" required/></label></>}{modal==="report"&&<><label>Report name<input name="name" required/></label><label>Report type<select name="type"><option>Operations</option><option>Financial</option><option>Season summary</option></select></label></>}{modal==="record"&&<><label>Record type<select name="type"><option>Crop activity</option><option>Scouting</option><option>Irrigation</option><option>Harvest</option></select></label><label>Field<select name="field">{fields.map(f=><option key={f.name}>{f.name}</option>)}</select></label><label>Details<textarea name="detail" required rows={3} placeholder="What happened?"/></label></>}<div className="form-actions"><button type="button" className="secondary" onClick={()=>setModal(null)}>Cancel</button><button type="submit" className="primary">Save</button></div></form></div></div>}<button className="chat-launcher" onClick={()=>setChatOpen(!chatOpen)}>{chatOpen?"Close":"Ask Farm Assistant"}</button>{chatOpen&&<aside className="chat-panel"><div className="chat-head"><div><strong>My Farm Assistant</strong><span>Farm operations support</span></div><i/></div><div className="chat-messages">{chatMessages.map((message,index)=><div className={message.from} key={index}>{message.text}</div>)}</div><div className="chat-suggestions">{["Will it rain?","Farm balance","Sensor status"].map(q=><button key={q} onClick={()=>setChatInput(q)}>{q}</button>)}</div><form onSubmit={askAssistant}><input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Ask about your farm…"/><button>Send</button></form></aside>}{toast&&<div className="toast"><Icon name="check"/> {toast}</div>}</div>;
}
