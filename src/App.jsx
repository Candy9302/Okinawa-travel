import React, { useState, useEffect } from "react";
import {
  Plane,
  MapPin,
  Calculator,
  Ticket,
  Sun,
  Cloud,
  CloudRain,
  PiggyBank,
  Gift,
  X,
  Plus,
  Trash2,
  Edit2,
  ChevronRight,
  Utensils,
  Coffee,
  ShoppingBag,
  Map,
} from "lucide-react";

const FAMILY_MEMBERS = ["爸爸", "媽媽", "妹妹", "書瑋", "我"];

export default function OkinawaTravelApp() {
  const [activeTab, setActiveTab] = useState("itinerary");
  const [showBirthday, setShowBirthday] = useState(false);
  const [currency, setCurrency] = useState("JPY");

  // API States
  const [exchangeRate, setExchangeRate] = useState(0.21); // 預設匯率
  const [weather, setWeather] = useState(null);
  const [editingId, setEditingId] = useState(null); // 新增這行：記錄正在編輯的 ID

  // 帳務 State (目前存 LocalStorage 模擬資料庫)
  const [expenses, setExpenses] = useState(() => {
    const saved = localStorage.getItem("okinawa_expenses");
    return saved ? JSON.parse(saved) : [];
  });

  // 記帳表單 State
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    title: "",
    amount: "",
    payer: "我",
    splitAmong: [...FAMILY_MEMBERS],
  });

  // 1. 抓取真實匯率與天氣 API
  useEffect(() => {
    // 匯率 API (JPY to TWD)
    fetch("https://api.exchangerate-api.com/v4/latest/JPY")
      .then((res) => res.json())
      .then((data) => setExchangeRate(data.rates.TWD))
      .catch(console.error);

    // Open-Meteo 天氣 API (那霸)
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=26.2124&longitude=127.6809&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTokyo",
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.daily) {
          setWeather({
            max: data.daily.temperature_2m_max[0],
            min: data.daily.temperature_2m_min[0],
            code: data.daily.weathercode[0],
          });
        }
      })
      .catch(console.error);
  }, []);

  // 2. 存入 LocalStorage (後續可替換為 Firebase)
  useEffect(() => {
    localStorage.setItem("okinawa_expenses", JSON.stringify(expenses));
  }, [expenses]);

  // 3. 妹妹生日彩蛋
  useEffect(() => {
    const today = new Date();
    if (today.getMonth() === 4 && today.getDate() === 13) {
      setShowBirthday(true);
    }
  }, []);

  // 新增/刪除花費邏輯
  const handleAddExpense = (e) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount) return;

    const newExpense = {
      id: Date.now(),
      title: expenseForm.title,
      amount: Number(expenseForm.amount),
      payer: expenseForm.payer,
      splitAmong: expenseForm.splitAmong,
    };

    setExpenses([newExpense, ...expenses]);
    setShowExpenseForm(false);
    setExpenseForm({
      title: "",
      amount: "",
      payer: "我",
      splitAmong: [...FAMILY_MEMBERS],
    });
  };

  const handleDeleteExpense = (id) => {
    if (window.confirm("確定要刪除這筆帳目嗎？")) {
      setExpenses(expenses.filter((e) => e.id !== id));
    }
  };

  const handleToggleSplitMember = (member) => {
    setExpenseForm((prev) => ({
      ...prev,
      splitAmong: prev.splitAmong.includes(member)
        ? prev.splitAmong.filter((m) => m !== member)
        : [...prev.splitAmong, member],
    }));
  };
  // 點擊編輯按鈕時，把資料塞回表單
  const handleEditExpense = (exp) => {
    setExpenseForm({
      title: exp.title,
      amount: exp.amount,
      payer: exp.payer,
      splitAmong: exp.splitAmong,
    });
    setEditingId(exp.id);
    setShowExpenseForm(true);
  };

  // 儲存邏輯 (區分新增或更新)
  const handleSaveExpense = (e) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount) return;

    if (editingId) {
      // 更新現有資料
      setExpenses(
        expenses.map((exp) =>
          exp.id === editingId
            ? { ...exp, ...expenseForm, amount: Number(expenseForm.amount) }
            : exp,
        ),
      );
      setEditingId(null);
    } else {
      // 新增資料
      const newExpense = {
        id: Date.now(),
        title: expenseForm.title,
        amount: Number(expenseForm.amount),
        payer: expenseForm.payer,
        splitAmong: expenseForm.splitAmong,
      };
      setExpenses([newExpense, ...expenses]);
    }
    setShowExpenseForm(false);
    setExpenseForm({
      title: "",
      amount: "",
      payer: "我",
      splitAmong: [...FAMILY_MEMBERS],
    });
  };

  // 取消編輯時也要清空狀態
  const handleCloseForm = () => {
    setShowExpenseForm(false);
    setEditingId(null);
    setExpenseForm({
      title: "",
      amount: "",
      payer: "我",
      splitAmong: [...FAMILY_MEMBERS],
    });
  };
  // 轉換日圓到台幣
  const formatTWD = (jpy) =>
    `NT$ ${Math.round(jpy * exchangeRate).toLocaleString()}`;
  const totalPublicSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  // 天氣代碼轉換 Icon
  const getWeatherIcon = (code) => {
    if (!code) return <Sun size={18} className="text-yellow-500" />;
    if (code <= 3) return <Cloud size={18} className="text-gray-400" />;
    return <CloudRain size={18} className="text-blue-400" />;
  };

  return (
    <div className="min-h-screen bg-[#f3f8f9] font-sans max-w-md mx-auto shadow-2xl relative overflow-hidden text-slate-700">
      {/* 妹妹生日 Popup */}
      {showBirthday && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 text-center shadow-2xl relative animate-bounce">
            <button
              onClick={() => setShowBirthday(false)}
              className="absolute top-4 right-4 text-gray-400"
            >
              <X size={24} />
            </button>
            <Gift className="w-16 h-16 text-rose-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              生日快樂！妹妹 🎉
            </h2>
            <p className="text-slate-600">在沖繩度過最棒的一天吧！</p>
          </div>
        </div>
      )}

      {/* Header - 改為柔和的莫蘭迪藍色調 */}
      <header className="bg-gradient-to-r from-[#93C5FD] to-[#A5F3FC] p-5 rounded-b-3xl shadow-sm sticky top-0 z-40">
        <div className="flex justify-between items-center text-slate-800">
          <div>
            <h1 className="text-xl font-extrabold tracking-wider text-slate-800">
              🌺 沖繩家族旅行
            </h1>
            <p className="text-sm font-medium text-slate-700">5/10 - 5/15</p>
          </div>
          <div
            className="bg-white/40 backdrop-blur-md px-3 py-2 rounded-2xl flex items-center gap-2 cursor-pointer border border-white/50 shadow-sm"
            onClick={() => setActiveTab("accounting")}
          >
            <PiggyBank size={24} className="text-amber-500" />
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-600">總花費</p>
              <p className="font-extrabold text-sm text-slate-800">
                {currency === "JPY"
                  ? `¥ ${totalPublicSpent.toLocaleString()}`
                  : formatTWD(totalPublicSpent)}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 pb-28 overflow-y-auto h-[calc(100vh-80px)]">
        {activeTab === "itinerary" && (
          <ItineraryView
            weather={weather}
            getWeatherIcon={getWeatherIcon}
            exchangeRate={exchangeRate}
          />
        )}

        {activeTab === "accounting" && (
          <AccountingView
            expenses={expenses}
            currency={currency}
            setCurrency={setCurrency}
            formatTWD={formatTWD}
            showExpenseForm={showExpenseForm}
            setShowExpenseForm={setShowExpenseForm}
            expenseForm={expenseForm}
            setExpenseForm={setExpenseForm}
            handleAddExpense={handleAddExpense}
            handleDeleteExpense={handleDeleteExpense}
            handleToggleSplitMember={handleToggleSplitMember}
          />
        )}

        {activeTab === "flights" && <FlightsView />}
        {activeTab === "coupons" && <CouponsView />}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full max-w-md bg-white/90 backdrop-blur-lg border-t border-slate-100 flex justify-around p-3 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-3xl z-40">
        <NavItem
          icon={<MapPin />}
          label="行程"
          isActive={activeTab === "itinerary"}
          onClick={() => setActiveTab("itinerary")}
        />
        <NavItem
          icon={<Calculator />}
          label="記帳結算"
          isActive={activeTab === "accounting"}
          onClick={() => setActiveTab("accounting")}
        />
        <NavItem
          icon={<Ticket />}
          label="優惠券"
          isActive={activeTab === "coupons"}
          onClick={() => setActiveTab("coupons")}
        />
        <NavItem
          icon={<Plane />}
          label="航班"
          isActive={activeTab === "flights"}
          onClick={() => setActiveTab("flights")}
        />
      </nav>
    </div>
  );
}

// 導覽按鈕
function NavItem({ icon, label, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center transition-all duration-300 ${isActive ? "text-sky-600 scale-110" : "text-slate-400 hover:text-sky-400"}`}
    >
      {React.cloneElement(icon, { size: 22, strokeWidth: isActive ? 2.5 : 2 })}
      <span
        className={`text-[10px] mt-1 ${isActive ? "font-bold" : "font-medium"}`}
      >
        {label}
      </span>
    </button>
  );
}

// --- 視圖模組 (Views) ---

function ItineraryView({ weather, getWeatherIcon, exchangeRate }) {
  // 完整的六天行程資料結構
  const itineraryData = [
    {
      date: "5/10 (日)",
      title: "抵達與美國村",
      items: [
        {
          type: "flight",
          time: "12:20",
          title: "抵達 OKA (MM922)",
          desc: "取車前往北谷 (約40分)",
        },
        {
          type: "spot",
          time: "下午",
          title: "美國村逛街 & 日落海灘",
          desc: "看海、放鬆",
        },
        {
          type: "food",
          time: "晚餐",
          title: "小料理 廉",
          desc: "海鮮餐廳，免開車",
        },
      ],
    },
    {
      date: "5/11 (一)",
      title: "海洋博公園",
      items: [
        {
          type: "spot",
          time: "08:30",
          title: "美麗海水族館",
          desc: "早點出發避開人潮",
        },
        {
          type: "food",
          time: "午餐",
          title: "沖繩麵 (北部)",
          desc: "或在水族館內簡單吃",
        },
        { type: "spot", time: "下午", title: "古宇利島", desc: "喝杯咖啡放鬆" },
        {
          type: "shopping",
          time: "傍晚",
          title: "麵包店補給",
          desc: "買明天早餐",
        },
      ],
    },
    {
      date: "5/12 (二)",
      title: "往南移動",
      items: [
        {
          type: "food",
          time: "午餐",
          title: "北谷往那霸路上餐廳",
          desc: "順路吃不繞道",
        },
        {
          type: "spot",
          time: "下午",
          title: "Hotel Urbansea Check-in",
          desc: "國際通附近",
        },
        { type: "spot", time: "傍晚", title: "國際通逛街", desc: "採買伴手禮" },
        {
          type: "food",
          time: "晚餐",
          title: "牧志公設市場",
          desc: "國際通內，免開車",
        },
      ],
    },
    {
      date: "5/13 (三)",
      title: "神社與南部",
      items: [
        {
          type: "spot",
          time: "上午",
          title: "波上宮",
          desc: "早去人少，海邊神社拍照",
        },
        {
          type: "spot",
          time: "下午",
          title: "南部海景 或 Outlet",
          desc: "親子輕鬆版行程",
        },
        { type: "food", time: "點心", title: "紅芋莎翁", desc: "推薦甜點" },
        {
          type: "food",
          time: "晚餐",
          title: "居酒屋",
          desc: "氣氛好，適合聚餐",
        },
      ],
    },
    {
      date: "5/14 (四)",
      title: "彈性自由日",
      items: [
        {
          type: "spot",
          time: "全天",
          title: "Buffer Day",
          desc: "帶長輩小孩必備的彈性時間",
        },
        { type: "food", time: "午餐", title: "豬排飯", desc: "補吃推薦美食" },
        {
          type: "shopping",
          time: "下午",
          title: "國際通補買",
          desc: "最後血拚時間",
        },
      ],
    },
    {
      date: "5/15 (五)",
      title: "回程",
      items: [
        { type: "spot", time: "14:00", title: "前往機場", desc: "抓1小時車程" },
        {
          type: "flight",
          time: "16:10",
          title: "起飛 (OD883)",
          desc: "17:30 抵達桃園",
        },
      ],
    },
  ];

  const getIcon = (type) => {
    switch (type) {
      case "flight":
        return <Plane className="text-sky-500" size={18} />;
      case "spot":
        return <MapPin className="text-teal-500" size={18} />;
      case "food":
        return <Utensils className="text-orange-400" size={18} />;
      case "shopping":
        return <ShoppingBag className="text-rose-400" size={18} />;
      default:
        return <Map className="text-slate-400" size={18} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 資訊看板 */}
      <div className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-slate-100">
        <div>
          <h3 className="font-bold flex items-center gap-2 text-slate-700">
            {getWeatherIcon(weather?.code)} 那霸天氣
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {weather ? `${weather.min}°C - ${weather.max}°C` : "載入中..."}
          </p>
        </div>
        <div className="text-right border-l pl-4 border-slate-100">
          <p className="text-xs text-slate-400">即時匯率 (TWD)</p>
          <p className="font-extrabold text-lg text-slate-700">
            {exchangeRate.toFixed(3)}
          </p>
        </div>
      </div>

      {/* 行程列表 */}
      <div className="relative border-l-2 border-sky-200 ml-4 pl-6 py-2 space-y-8">
        {itineraryData.map((day, index) => (
          <div key={index} className="relative">
            <div className="absolute -left-[35px] top-0 bg-sky-100 text-sky-700 border-2 border-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm">
              {index + 1}
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              {day.date} {day.title}
            </h2>

            <div className="mt-3 bg-white rounded-2xl p-4 shadow-sm border border-slate-50 space-y-4">
              {day.items.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="mt-1 p-1.5 bg-slate-50 rounded-lg">
                    {getIcon(item.type)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 text-sm">
                      <span className="text-sky-600 mr-2">{item.time}</span>
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccountingView({
  expenses,
  currency,
  setCurrency,
  formatTWD,
  showExpenseForm,
  setShowExpenseForm,
  expenseForm,
  setExpenseForm,
  handleAddExpense,
  handleDeleteExpense,
  handleToggleSplitMember,
}) {
  const [view, setView] = useState("list");

  // 自動結算核心邏輯
  const calculateSettlement = () => {
    let balances = {};
    FAMILY_MEMBERS.forEach((m) => (balances[m] = 0));

    expenses.forEach((exp) => {
      balances[exp.payer] += exp.amount;
      const splitAmount = exp.amount / exp.splitAmong.length;
      exp.splitAmong.forEach((person) => {
        balances[person] -= splitAmount;
      });
    });

    let debtors = [],
      creditors = [],
      transfers = [];
    for (let p in balances) {
      if (balances[p] < -0.5)
        debtors.push({ person: p, amount: Math.abs(balances[p]) });
      if (balances[p] > 0.5) creditors.push({ person: p, amount: balances[p] });
    }

    let d = 0,
      c = 0;
    while (d < debtors.length && c < creditors.length) {
      let amount = Math.min(debtors[d].amount, creditors[c].amount);
      transfers.push({
        from: debtors[d].person,
        to: creditors[c].person,
        amount: Math.round(amount),
      });
      debtors[d].amount -= amount;
      creditors[c].amount -= amount;
      if (debtors[d].amount < 0.5) d++;
      if (creditors[c].amount < 0.5) c++;
    }
    return transfers;
  };

  return (
    <div className="space-y-4">
      {/* 切換 Tabs */}
      <div className="flex bg-slate-200/50 rounded-xl p-1 shadow-inner">
        <button
          onClick={() => setView("list")}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${view === "list" ? "bg-white shadow text-sky-700" : "text-slate-500"}`}
        >
          📝 記帳明細
        </button>
        <button
          onClick={() => setView("settlement")}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${view === "settlement" ? "bg-white shadow text-sky-700" : "text-slate-500"}`}
        >
          🖩 結算中心
        </button>
      </div>

      {view === "list" ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <button
              onClick={() => setCurrency((c) => (c === "JPY" ? "TWD" : "JPY"))}
              className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full font-bold active:scale-95 transition-transform"
            >
              切換為 {currency === "JPY" ? "台幣 (TWD)" : "日幣 (JPY)"} 顯示
            </button>
          </div>

          {/* 花費列表 */}
          {expenses.length === 0 && (
            <p className="text-center text-slate-400 py-10">
              目前還沒有記帳紀錄喔！
            </p>
          )}
          {expenses.map((exp) => (
            <div
              key={exp.id}
              className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-2 relative group"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-slate-800 text-lg">
                    {exp.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="font-bold text-sky-600">{exp.payer}</span>{" "}
                    先付 ➔ 分攤給: {exp.splitAmong.join(", ")}
                  </p>
                </div>
                <p className="font-extrabold text-rose-500 text-lg">
                  {currency === "JPY"
                    ? `¥${exp.amount.toLocaleString()}`
                    : formatTWD(exp.amount)}
                </p>
              </div>
              <div className="absolute bottom-4 right-4 flex gap-3 text-slate-300">
                <button
                  onClick={() => handleEditExpense(exp)}
                  className="hover:text-sky-500 p-1"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDeleteExpense(exp.id)}
                  className="hover:text-red-400 p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          {/* 新增按鈕 / 表單 */}
          {!showExpenseForm ? (
            <button
              onClick={() => setShowExpenseForm(true)}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3.5 rounded-xl shadow-md mt-4 active:scale-95 transition-all flex justify-center items-center gap-2"
            >
              <Plus size={20} /> 新增一筆花費
            </button>
          ) : (
            <form
              onSubmit={handleSaveExpense}
              className="bg-white p-5 rounded-2xl shadow-lg border border-sky-100 mt-4 space-y-4 animate-in slide-in-from-bottom-4"
            >
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="font-bold text-slate-800">新增記帳</h3>
                <button type="button" onClick={() => setShowExpenseForm(false)}>
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500">
                  項目名稱
                </label>
                <input
                  required
                  type="text"
                  value={expenseForm.title}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, title: e.target.value })
                  }
                  className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-200 outline-none"
                  placeholder="例如：晚餐烤肉"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500">
                  金額 (日幣 ¥)
                </label>
                <input
                  required
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, amount: e.target.value })
                  }
                  className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-200 outline-none"
                  placeholder="輸入日幣金額"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500">
                  誰先付的？
                </label>
                <select
                  value={expenseForm.payer}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, payer: e.target.value })
                  }
                  className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                >
                  {FAMILY_MEMBERS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 mb-2 block">
                  這筆誰要分攤？
                </label>
                <div className="flex flex-wrap gap-2">
                  {FAMILY_MEMBERS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleToggleSplitMember(m)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${expenseForm.splitAmong.includes(m) ? "bg-sky-500 text-white shadow-sm" : "bg-slate-100 text-slate-500"}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-md mt-2 active:scale-95"
              >
                儲存
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <h3 className="font-bold text-slate-800 border-b pb-3 flex items-center gap-2">
            <Calculator size={18} className="text-teal-500" /> 最佳還款路徑
          </h3>
          <p className="text-xs text-slate-500">
            系統已自動計算抵銷，直接照下面轉帳即可：
          </p>

          {calculateSettlement().length === 0 ? (
            <p className="text-center text-slate-400 py-6">
              目前沒有人欠錢喔！
            </p>
          ) : (
            calculateSettlement().map((t, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-[#f8fafc] border border-slate-100 p-3.5 rounded-xl"
              >
                <span className="font-bold text-slate-700 w-12 text-center">
                  {t.from}
                </span>
                <div className="flex flex-col items-center flex-1 text-slate-400">
                  <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full mb-1">
                    給
                  </span>
                  <ChevronRight size={16} />
                </div>
                <span className="font-bold text-slate-700 w-12 text-center">
                  {t.to}
                </span>
                <div className="text-right ml-2">
                  <span className="font-extrabold text-sky-600 block">
                    ¥ {t.amount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {formatTWD(t.amount)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function FlightsView() {
  return (
    <div className="space-y-4">
      <h2 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
        <Plane size={20} /> 航班資訊
      </h2>

      <div className="bg-white rounded-2xl p-5 shadow-sm border-t-4 border-t-sky-400 relative overflow-hidden">
        <div className="absolute top-2 right-2 text-xs font-bold text-sky-600 bg-sky-100 px-2 py-1 rounded-md">
          去程 5/10
        </div>
        <p className="text-sm font-bold text-slate-500 mb-2">樂桃航空 MM922</p>
        <div className="flex justify-between items-center mt-4">
          <div className="text-center">
            <p className="text-3xl font-extrabold text-slate-800">09:35</p>
            <p className="text-sm font-medium text-slate-500 mt-1">
              台北 (TPE)
            </p>
          </div>
          <div className="flex-1 px-4 flex flex-col items-center">
            <p className="text-xs text-slate-400 mb-1">1h 45m</p>
            <div className="w-full border-t-2 border-dashed border-slate-200 relative">
              <Plane
                size={16}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sky-300 transform rotate-45"
              />
            </div>
          </div>
          <div className="text-center">
            <p className="text-3xl font-extrabold text-slate-800">12:20</p>
            <p className="text-sm font-medium text-slate-500 mt-1">
              那霸 (OKA)
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border-t-4 border-t-rose-400 relative overflow-hidden">
        <div className="absolute top-2 right-2 text-xs font-bold text-rose-600 bg-rose-100 px-2 py-1 rounded-md">
          回程 5/15
        </div>
        <p className="text-sm font-bold text-slate-500 mb-2">馬印航空 OD883</p>
        <div className="flex justify-between items-center mt-4">
          <div className="text-center">
            <p className="text-3xl font-extrabold text-slate-800">16:10</p>
            <p className="text-sm font-medium text-slate-500 mt-1">
              那霸 (OKA)
            </p>
          </div>
          <div className="flex-1 px-4 flex flex-col items-center">
            <p className="text-xs text-slate-400 mb-1">1h 20m</p>
            <div className="w-full border-t-2 border-dashed border-slate-200 relative">
              <Plane
                size={16}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-rose-300 transform -rotate-45 scale-x-[-1]"
              />
            </div>
          </div>
          <div className="text-center">
            <p className="text-3xl font-extrabold text-slate-800">17:30</p>
            <p className="text-sm font-medium text-slate-500 mt-1">
              台北 (TPE)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CouponsView() {
  // 將你提供的截圖資訊寫入資料，後續可以把圖片放到 public 資料夾中
  const coupons = [
    {
      name: "SUGI 杉藥局",
      imgSrc: "/sugi.png", // 之後把截圖命名為 sugi.png 放到 public/
      thresholds: [
        { spend: "1萬~3萬", off: "免稅10% + 4% OFF" },
        { spend: "3萬~5萬", off: "免稅10% + 6% OFF" },
        { spend: "5萬+", off: "免稅10% + 8% OFF" },
      ],
    },
    {
      name: "松本清 Matsumoto Kiyoshi",
      imgSrc: "/matsumoto.png",
      thresholds: [
        { spend: "1萬~3萬", off: "3% OFF" },
        { spend: "3萬~5萬", off: "5% OFF" },
        { spend: "5萬+", off: "7% OFF" },
      ],
    },
    {
      name: "札幌藥妝 (北海道連鎖)",
      imgSrc: "/sapporo.png",
      thresholds: [{ spend: "無門檻", off: "免稅 + 5% OFF" }],
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-slate-800 text-lg mb-2 flex items-center gap-2">
        <Ticket size={20} /> 專屬優惠券
      </h2>
      {coupons.map((coupon, idx) => (
        <div
          key={idx}
          className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4 group cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-extrabold text-sky-800 text-lg">
              {coupon.name}
            </h3>
            <span className="text-[10px] bg-rose-50 text-rose-600 px-2 py-1 rounded-md font-bold">
              點擊顯示條碼
            </span>
          </div>

          <div className="space-y-1.5 mb-4">
            {coupon.thresholds.map((t, i) => (
              <div
                key={i}
                className="flex justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100"
              >
                <span className="text-sm font-medium text-slate-600">
                  滿 <span className="font-bold text-slate-800">{t.spend}</span>{" "}
                  日圓
                </span>
                <span className="text-sm font-extrabold text-rose-500">
                  {t.off}
                </span>
              </div>
            ))}
          </div>

          {/* 模擬條碼區塊 (後續換成 img 標籤讀取你的截圖) */}
          <div className="w-full h-16 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200 border-dashed relative overflow-hidden">
            {/* 如果有圖片就用這行：<img src={coupon.imgSrc} className="w-full h-full object-cover" /> */}
            <div className="flex gap-1 items-center opacity-30">
              <div className="w-1 h-10 bg-slate-800"></div>
              <div className="w-2 h-10 bg-slate-800"></div>
              <div className="w-1 h-10 bg-slate-800"></div>
              <div className="w-3 h-10 bg-slate-800"></div>
              <span className="px-2 font-mono text-sm tracking-widest text-slate-800">
                點擊顯示圖片
              </span>
              <div className="w-2 h-10 bg-slate-800"></div>
              <div className="w-1 h-10 bg-slate-800"></div>
              <div className="w-2 h-10 bg-slate-800"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
