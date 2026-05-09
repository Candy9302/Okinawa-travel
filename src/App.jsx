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
  ShoppingBag,
  Map,
  Building,
  Key,
  Info,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Dices,
} from "lucide-react";
import { db, firebaseInitError } from "./services/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  setDoc,
  query,
  orderBy,
} from "firebase/firestore";

const FAMILY_MEMBERS = ["爸爸", "媽媽", "妹妹", "書瑋", "我"];
const SPONSOR_CANDIDATES = ["爸爸", "媽媽", "Candy", "書瑋"]; // 買單金主候選人
const SECRET_REDEEM_CODE = "candy"; // 妹妹兌換獎品的專屬密碼

// 判斷哪些獎品需要馬上抽金主
const SPONSOR_KEYWORDS = [
  "小零食基金",
  "沖繩小物",
  "全家飲料王",
  "神秘扭蛋權",
  "免單券",
  "炸雞券",
  "免費飲料券",
];
const needsSponsor = (prizeText) =>
  SPONSOR_KEYWORDS.some((k) => prizeText.includes(k));

const DRAW_STATION_PARTICIPANTS = ["爸爸", "媽媽", "妹妹", "Candy", "書瑋"];
const DRAW_STATION_WITHOUT_SISTER = DRAW_STATION_PARTICIPANTS.filter(
  (name) => name !== "妹妹",
);
const BIRTHDAY_SURPRISE_KEY = "okinawa_birthday_surprise_hour";

function getDbOrThrow() {
  if (!db) {
    throw new Error(
      firebaseInitError ||
        "Firebase is unavailable. Check environment variables and permissions.",
    );
  }

  return db;
}

function getCurrentHourStamp() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}`;
}

function createSecretGuessRows(participants) {
  return participants.map((name) => ({
    name,
    guess: "",
  }));
}

export default function OkinawaTravelApp() {
  const [activeTab, setActiveTab] = useState("itinerary");
  const [currency, setCurrency] = useState("JPY");

  // 生日與特殊彩蛋狀態
  const [showBirthday, setShowBirthday] = useState(false);
  const [isBirthdayActive, setIsBirthdayActive] = useState(false); // 5/13 才為 true

  // 🚀 自訂兌換密碼 Modal State
  const [redeemState, setRedeemState] = useState({
    isOpen: false,
    prizeId: null,
    code: "",
  });

  // API & 基礎 States
  const [exchangeRate, setExchangeRate] = useState(0.21);
  const [weatherData, setWeatherData] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [firebaseError, setFirebaseError] = useState(firebaseInitError);
  const [birthdaySurpriseStamp, setBirthdaySurpriseStamp] = useState(
    () => localStorage.getItem(BIRTHDAY_SURPRISE_KEY) || "",
  );

  // Firebase: 妹妹的百寶袋 & 金主抽籤紀錄
  const [sisterPrizes, setSisterPrizes] = useState([]);
  const [showPrizeBag, setShowPrizeBag] = useState(false);
  const [sponsorDraws, setSponsorDraws] = useState([]);

  // 本機暫存: 飯店房號 & 門票
  const [rooms, setRooms] = useState(() => {
    const saved = localStorage.getItem("okinawa_rooms");
    return saved ? JSON.parse(saved) : { montpa: "", urbansea: "" };
  });
  const [usedTickets, setUsedTickets] = useState(() => {
    const saved = localStorage.getItem("okinawa_tickets");
    return saved ? JSON.parse(saved) : {};
  });

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    title: "",
    amount: "",
    exchangeRate: "",
    payer: "我",
    splitAmong: [...FAMILY_MEMBERS],
  });

  // LocalStorage 同步
  useEffect(() => {
    localStorage.setItem("okinawa_rooms", JSON.stringify(rooms));
  }, [rooms]);

  useEffect(() => {
    localStorage.setItem("okinawa_tickets", JSON.stringify(usedTickets));
  }, [usedTickets]);

  // Firebase 監聽器
  useEffect(() => {
    if (!db) return;
    const usedTicketsRef = doc(db, "shared_data", "used_tickets");
    const usedTicketsUnsubscribe = onSnapshot(
      usedTicketsRef,
      (docSnap) => {
        setFirebaseError(null);
        if (!docSnap.exists()) return;

        const data = docSnap.data();
        if (data?.tickets && typeof data.tickets === "object") {
          setUsedTickets(data.tickets);
        }
      },
      (error) => {
        console.error("used_tickets snapshot failed:", error);
        setFirebaseError("Firebase ticket sync failed. Showing local data.");
      },
    );

    const docRef = doc(db, "shared_data", "rooms");
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        setFirebaseError(null);
        if (docSnap.exists()) setRooms(docSnap.data());
      },
      (error) => {
        console.error("rooms snapshot failed:", error);
        setFirebaseError("Firebase rooms sync failed. Showing local data.");
      },
    );
    return () => {
      usedTicketsUnsubscribe();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setFirebaseError(null);
        setExpenses(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
      (error) => {
        console.error("expenses snapshot failed:", error);
        setFirebaseError(
          "Firebase expenses sync failed. Showing cached screen.",
        );
      },
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "sister_prizes"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setFirebaseError(null);
        setSisterPrizes(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
      (error) => {
        console.error("sister_prizes snapshot failed:", error);
        setFirebaseError("Firebase prize sync failed.");
      },
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db) return;
    const q = query(
      collection(db, "payer_draws"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setFirebaseError(null);
        setSponsorDraws(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
      (error) => {
        console.error("payer_draws snapshot failed:", error);
        setFirebaseError("Firebase sponsor draw sync failed.");
      },
    );
    return () => unsubscribe();
  }, []);

  // 天氣與匯率 API
  useEffect(() => {
    fetch("https://api.exchangerate-api.com/v4/latest/JPY")
      .then((res) => res.json())
      .then((data) => {
        setExchangeRate(data.rates.TWD);
        // 如果目前表單的匯率是空的，就用即時匯率填入
        setExpenseForm((prev) => ({
          ...prev,
          exchangeRate: prev.exchangeRate || data.rates.TWD.toString(),
        }));
      })
      .catch(console.error);

    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=26.2124&longitude=127.6809&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTokyo&forecast_days=16",
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.daily) {
          const newWeather = {};
          data.daily.time.forEach((date, index) => {
            newWeather[date] = {
              max: data.daily.temperature_2m_max[index],
              min: data.daily.temperature_2m_min[index],
              code: data.daily.weathercode[index],
            };
          });
          setWeatherData(newWeather);
        }
      })
      .catch(console.error);
  }, []);

  // 生日自動觸發判定 (嚴格鎖定 5/13)
  useEffect(() => {
    const today = new Date();
    if (today.getMonth() === 4 && today.getDate() === 13) {
      setIsBirthdayActive(true);
      setShowBirthday(true);
    }
  }, []);

  // 🚀 修正：打開表單時，自動帶入最新匯率
  const handleOpenForm = () => {
    setExpenseForm({
      title: "",
      amount: "",
      exchangeRate: exchangeRate,
      payer: "我",
      splitAmong: [...FAMILY_MEMBERS],
    });
    setShowExpenseForm(true);
    setEditingId(null);
  };

  const handleEditExpense = (exp) => {
    setExpenseForm({
      title: exp.title,
      amount: exp.amount,
      exchangeRate: exp.exchangeRate || exchangeRate, // 若無則用最新匯率
      payer: exp.payer,
      splitAmong: exp.splitAmong,
    });
    setEditingId(exp.id);
    setShowExpenseForm(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount) return;

    const dataToSave = {
      ...expenseForm,
      amount: Number(expenseForm.amount),
      exchangeRate: Number(expenseForm.exchangeRate) || exchangeRate,
    };

    const currentEditId = editingId;
    setShowExpenseForm(false);
    setEditingId(null);
    setExpenseForm({
      title: "",
      amount: "",
      exchangeRate: exchangeRate,
      payer: "我",
      splitAmong: [...FAMILY_MEMBERS],
    });

    try {
      const firestore = getDbOrThrow();
      if (currentEditId) {
        await updateDoc(doc(firestore, "expenses", currentEditId), dataToSave);
      } else {
        await addDoc(collection(firestore, "expenses"), {
          ...dataToSave,
          createdAt: Date.now(),
        });
      }
    } catch (error) {
      setFirebaseError(error.message);
      alert(`Firebase 寫入失敗！\n錯誤訊息：${error.message}`);
    }
  };

  const handleCloseForm = () => {
    setShowExpenseForm(false);
    setEditingId(null);
    setExpenseForm({
      title: "",
      amount: "",
      exchangeRate: exchangeRate,
      payer: "我",
      splitAmong: [...FAMILY_MEMBERS],
    });
  };

  const handleDeleteExpense = async (id) => {
    if (window.confirm("確定要刪除這筆帳目嗎？")) {
      try {
        const firestore = getDbOrThrow();
        await deleteDoc(doc(firestore, "expenses", id));
      } catch (error) {
        setFirebaseError(error.message);
        alert(error.message);
      }
    }
  };

  const handleToggleUsedTicket = async (ticketId) => {
    const nextUsedTickets = {
      ...usedTickets,
      [ticketId]: !usedTickets[ticketId],
    };

    setUsedTickets(nextUsedTickets);

    try {
      const firestore = getDbOrThrow();
      await setDoc(doc(firestore, "shared_data", "used_tickets"), {
        tickets: nextUsedTickets,
        updatedAt: Date.now(),
      });
      setFirebaseError(null);
    } catch (error) {
      setFirebaseError(error.message);
      alert(error.message);
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

  // 自訂密碼兌換功能
  const submitRedeemCode = async () => {
    if (redeemState.code.toLowerCase() === SECRET_REDEEM_CODE.toLowerCase()) {
      try {
        const firestore = getDbOrThrow();
        await updateDoc(doc(firestore, "sister_prizes", redeemState.prizeId), {
          status: "redeemed",
        });
        setRedeemState({ isOpen: false, prizeId: null, code: "" });
      } catch (error) {
        alert("更新失敗：" + error.message);
      }
    } else {
      alert("❌ 密碼錯誤！休想偷換！請找 Candy 姊姊！");
    }
  };

  // 金主抽籤邏輯 (支援聯動獎品與 3 種動畫效果)
  const [sponsorDrawState, setSponsorDrawState] = useState({
    isOpen: false,
    isRolling: false,
    mode: "random",
    scenario: "sponsor",
    scenarioLabel: "",
    description: "",
    drawType: "slot",
    name: "",
    result: null,
    pendingPrize: null,
    candidates: [],
    secretNumber: null,
    secretGuesses: [],
    secretWinner: null,
  });

  const currentHourStamp = getCurrentHourStamp();
  const isBirthdaySurpriseAvailable =
    birthdaySurpriseStamp !== currentHourStamp;

  const closeSponsorDraw = () => {
    setSponsorDrawState({
      isOpen: false,
      isRolling: false,
      mode: "random",
      scenario: "sponsor",
      scenarioLabel: "",
      description: "",
      drawType: "slot",
      name: "",
      result: null,
      pendingPrize: null,
      candidates: [],
      secretNumber: null,
      secretGuesses: [],
      secretWinner: null,
    });
  };

  const legacyStartSponsorDraw = (pendingPrize = null) => {
    const isPrizeObj = pendingPrize && pendingPrize.title;

    // 隨機決定要用哪種動畫呈現
    const drawTypes = ["slot", "grid", "spotlight"];
    const randomType = drawTypes[Math.floor(Math.random() * drawTypes.length)];

    setSponsorDrawState({
      isOpen: true,
      isRolling: true,
      name: SPONSOR_CANDIDATES[0],
      result: null,
      pendingPrize: isPrizeObj ? pendingPrize : null,
      drawType: randomType,
    });

    let counter = 0;
    const interval = setInterval(() => {
      setSponsorDrawState((prev) => ({
        ...prev,
        name: SPONSOR_CANDIDATES[counter % SPONSOR_CANDIDATES.length],
      }));
      counter++;
    }, 100);

    setTimeout(async () => {
      clearInterval(interval);
      const winner =
        SPONSOR_CANDIDATES[
          Math.floor(Math.random() * SPONSOR_CANDIDATES.length)
        ];

      setSponsorDrawState((prev) => ({
        ...prev,
        isRolling: false,
        name: winner,
        result: winner,
      }));

      try {
        const firestore = getDbOrThrow();
        await addDoc(collection(firestore, "payer_draws"), {
          payer: winner,
          createdAt: Date.now(),
        });

        if (isPrizeObj) {
          await addDoc(collection(firestore, "sister_prizes"), {
            title: pendingPrize.title,
            desc: pendingPrize.desc,
            prize: pendingPrize.prize,
            sponsor: winner,
            status: "available",
            createdAt: Date.now(),
          });
        }
      } catch (err) {
        setFirebaseError(err.message);
        console.error("儲存失敗", err);
      }
    }, 3000);
  };

  const finishLuckyDraw = async ({
    winner,
    scenario,
    scenarioLabel,
    pendingPrize = null,
    secretNumber = null,
    secretWinner = null,
  }) => {
    setSponsorDrawState((prev) => ({
      ...prev,
      isRolling: false,
      name: winner,
      result: winner,
      secretNumber,
      secretWinner,
    }));

    try {
      const firestore = getDbOrThrow();
      await addDoc(collection(firestore, "payer_draws"), {
        payer: winner,
        scenario,
        scenarioLabel,
        createdAt: Date.now(),
      });

      if (pendingPrize) {
        await addDoc(collection(firestore, "sister_prizes"), {
          title: pendingPrize.title,
          desc: pendingPrize.desc,
          prize: pendingPrize.prize,
          sponsor: winner,
          status: "available",
          createdAt: Date.now(),
        });
      }
    } catch (error) {
      setFirebaseError(error.message);
      alert(error.message);
    }
  };

  const startLuckyDraw = ({
    scenario = "sponsor",
    pendingPrize = null,
    excludeSister = false,
    forceBirthday = false,
  } = {}) => {
    if (forceBirthday && !isBirthdaySurpriseAvailable) return;

    const candidates = excludeSister
      ? DRAW_STATION_WITHOUT_SISTER
      : DRAW_STATION_PARTICIPANTS;
    const gameModes = ["random", "wheel", "secret"];
    const mode = gameModes[Math.floor(Math.random() * gameModes.length)];
    const scenarioMap = {
      birthday: {
        label: "妹妹生日驚喜抽籤",
        description: "從神社入口啟動，妹妹不參加抽籤。",
      },
      "meal-free": {
        label: "吃飯幸運兒抽籤",
        description: "抽出本餐免費的人，不排除妹妹。",
      },
      sponsor: {
        label: "直接金主抽籤",
        description: "抽出本次負責買單的人，不排除妹妹。",
      },
    };
    const { label, description } = scenarioMap[scenario];

    if (forceBirthday) {
      localStorage.setItem(BIRTHDAY_SURPRISE_KEY, currentHourStamp);
      setBirthdaySurpriseStamp(currentHourStamp);
    }

    setSponsorDrawState({
      isOpen: true,
      isRolling: mode !== "secret",
      mode,
      scenario,
      scenarioLabel: label,
      description,
      drawType:
        mode === "random" ? "slot" : mode === "wheel" ? "spotlight" : "secret",
      name: candidates[0],
      result: null,
      pendingPrize,
      candidates,
      secretNumber: mode === "secret" ? Math.floor(Math.random() * 100) + 1 : null,
      secretGuesses:
        mode === "secret" ? createSecretGuessRows(candidates) : [],
      secretWinner: null,
    });

    if (mode === "secret") return;

    let counter = 0;
    const interval = setInterval(() => {
      setSponsorDrawState((prev) => ({
        ...prev,
        name: candidates[counter % candidates.length],
      }));
      counter++;
    }, mode === "wheel" ? 90 : 120);

    setTimeout(() => {
      clearInterval(interval);
      const winner = candidates[Math.floor(Math.random() * candidates.length)];
      finishLuckyDraw({
        winner,
        scenario,
        scenarioLabel: label,
        pendingPrize,
      });
    }, 3000);
  };

  const submitSecretLuckyDraw = async () => {
    const guesses = sponsorDrawState.secretGuesses.map((entry) => ({
      ...entry,
      guess: Number(entry.guess),
    }));
    const hasInvalidGuess = guesses.some(
      (entry) =>
        !entry.name.trim() ||
        Number.isNaN(entry.guess) ||
        entry.guess < 1 ||
        entry.guess > 100,
    );

    if (hasInvalidGuess) {
      alert("請輸入每位參與者的名字，以及 1 到 100 的數字。");
      return;
    }

    const winner = guesses.reduce((best, current) => {
      const diff = Math.abs(current.guess - sponsorDrawState.secretNumber);
      if (!best || diff < best.diff) {
        return { ...current, diff };
      }
      return best;
    }, null);

    await finishLuckyDraw({
      winner: winner.name,
      scenario: sponsorDrawState.scenario,
      scenarioLabel: sponsorDrawState.scenarioLabel,
      pendingPrize: sponsorDrawState.pendingPrize,
      secretNumber: sponsorDrawState.secretNumber,
      secretWinner: winner,
    });
  };

  const startSponsorDraw = (pendingPrize = null) => {
    startLuckyDraw({ scenario: "sponsor", pendingPrize });
  };

  const formatTWD = (jpy) =>
    `NT$ ${Math.round(jpy * exchangeRate).toLocaleString()}`;

  const totalPublicSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  // 🚀 修正：定義台幣總花費 (給 Header 顯示使用)
  const totalPublicSpentTWD = expenses.reduce((sum, exp) => {
    const rateToUse = exp.exchangeRate || exchangeRate;
    return sum + exp.amount * rateToUse;
  }, 0);

  const getWeatherIcon = (code) => {
    if (code === undefined)
      return <Cloud size={16} className="text-slate-300" />;
    if (code <= 3) return <Sun size={16} className="text-yellow-500" />;
    return <CloudRain size={16} className="text-blue-400" />;
  };

  return (
    <div className="min-h-screen bg-[#f3f8f9] font-sans max-w-md mx-auto shadow-2xl relative overflow-hidden text-slate-700">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-float { animation: float 3s ease-in-out infinite; }
        @keyframes shake-omikuji { 0%, 100% { transform: rotate(0deg) translateY(0); } 25% { transform: rotate(-15deg) translateY(-10px); } 50% { transform: rotate(15deg) translateY(5px); } 75% { transform: rotate(-15deg) translateY(-10px); } }
        .animate-shake-omikuji { animation: shake-omikuji 0.15s ease-in-out infinite; }
        @keyframes fall-stick { 0% { transform: translateY(-20px) rotate(180deg); opacity: 0; } 100% { transform: translateY(80px) rotate(180deg); opacity: 1; } }
        .animate-fall-stick { animation: fall-stick 0.8s ease-out forwards; }
        @keyframes fall-sakura { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(360deg); opacity: 0; } }
        @keyframes slot-spin { 0% { transform: translateY(-100%); opacity: 0; } 50% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(100%); opacity: 0; } }
        .animate-slot-spin { animation: slot-spin 0.1s linear infinite; }
      `}</style>
      {firebaseError && (
        <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
          Firebase unavailable. The page is still usable with partial/local
          data.
        </div>
      )}

      {/* 自訂密碼兌換 Modal */}
      {redeemState.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() =>
              setRedeemState({ isOpen: false, prizeId: null, code: "" })
            }
          ></div>
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                <Key size={18} className="text-rose-500" /> 輸入兌換密碼
              </h3>
              <button
                onClick={() =>
                  setRedeemState({ isOpen: false, prizeId: null, code: "" })
                }
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-3 leading-relaxed">
              請將手機交給{" "}
              <span className="font-bold text-rose-500">Candy 姊姊</span>
              ，由她為你輸入專屬的魔法密碼解鎖獎品！
            </p>
            <input
              type="password"
              value={redeemState.code}
              onChange={(e) =>
                setRedeemState({ ...redeemState, code: e.target.value })
              }
              className="w-full border-2 border-slate-200 p-3.5 rounded-xl mb-5 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none text-center text-xl tracking-[0.5em] font-black text-slate-700"
              placeholder="••••"
              autoFocus
            />
            <button
              onClick={submitRedeemCode}
              className="w-full bg-gradient-to-r from-rose-400 to-pink-500 text-white font-bold py-3.5 rounded-xl shadow-md active:scale-95 transition-all"
            >
              確認兌換
            </button>
          </div>
        </div>
      )}

      {/* 妹妹生日驚喜卡片 */}
      {showBirthday && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>
          <div className="absolute top-0 left-0 w-full h-full opacity-60 bg-[radial-gradient(circle_at_50%_40%,_rgba(251,113,133,0.4),_transparent_70%)]"></div>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute text-pink-300 opacity-70"
                style={{
                  top: `${Math.random() * -20}%`,
                  left: `${Math.random() * 100}%`,
                  animation: `fall-sakura ${Math.random() * 3 + 3}s linear infinite`,
                  animationDelay: `${Math.random() * 2}s`,
                  fontSize: `${Math.random() * 10 + 10}px`,
                }}
              >
                🌸
              </div>
            ))}
          </div>
          <div className="relative w-[85%] max-w-sm bg-white/10 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-6 pb-8 shadow-[0_0_50px_rgba(244,63,94,0.3)] animate-in zoom-in-90 duration-500 flex flex-col items-center">
            <button
              onClick={() => setShowBirthday(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/20 p-2 rounded-full backdrop-blur-sm transition-all active:scale-90 z-10"
            >
              <X size={20} />
            </button>
            <div className="absolute -top-5 bg-gradient-to-r from-rose-400 to-pink-500 text-white font-black px-6 py-1.5 rounded-full shadow-lg border border-white/50 flex items-center gap-2 transform -rotate-3">
              <Gift size={16} className="animate-pulse" />
              <span className="tracking-wide">Surprise!</span>
            </div>
            <div className="w-40 h-40 mt-8 mb-6 relative animate-float">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-200 to-amber-500 rounded-full blur-xl opacity-50"></div>
              <div className="w-full h-full bg-white/20 rounded-full border-2 border-white/60 flex items-center justify-center shadow-inner backdrop-blur-md relative overflow-hidden text-5xl">
                🐮🧳
                <div className="absolute bottom-3 right-4 text-2xl animate-pulse">
                  🌺
                </div>
                <div className="absolute top-3 left-3 text-2xl animate-bounce font-black text-rose-500">
                  ♉
                </div>
              </div>
            </div>
            <h2 className="text-3xl font-extrabold text-white text-center mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] tracking-wide">
              生日快樂！妹妹 🎉
            </h2>
            <div className="bg-white/10 rounded-2xl p-4 px-6 border border-white/20 text-center w-full shadow-inner relative">
              <span className="absolute -top-3 left-4 text-4xl text-rose-300 opacity-50 font-serif">
                "
              </span>
              <p className="text-white/95 font-bold leading-relaxed text-[15px]">
                在最美麗的沖繩海島
                <br />
                度過最棒的一天吧！
              </p>
              <div className="mt-3 text-rose-200 text-xs italic font-serif tracking-widest">
                ~ Graceful Okinawa Trip ~
              </div>
            </div>
            <button
              onClick={() => setShowBirthday(false)}
              className="mt-6 bg-gradient-to-r from-rose-400 to-pink-500 hover:from-rose-500 hover:to-pink-600 text-white font-bold w-full py-4 rounded-2xl shadow-[0_5px_20px_rgba(225,29,72,0.4)] active:scale-95 transition-all flex justify-center items-center gap-2 text-lg tracking-wide border border-white/20"
            >
              <Sun size={20} /> 展開今天的旅程
            </button>
          </div>
        </div>
      )}

      {/* 🚀 金主抽籤動畫 Modal (3種動畫效果切換) */}
      {sponsorDrawState.isOpen && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-[0_0_80px_rgba(251,191,36,0.3)] relative overflow-hidden">
            {!sponsorDrawState.isRolling && (
              <button
                onClick={closeSponsorDraw}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-1.5 active:scale-90 z-20"
              >
                <X size={20} />
              </button>
            )}

            <div className="text-5xl mb-6">💸</div>
            <h2 className="text-xl font-extrabold text-slate-500 mb-6">
              本次買單金主是...
            </h2>

            {/* 動畫類型 1：經典老虎機 (Slot) */}
            <div className="mb-6 -mt-2">
              <p className="text-lg font-extrabold text-slate-700">
                {sponsorDrawState.scenarioLabel || "抽籤中"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {sponsorDrawState.description}
              </p>
            </div>
            {sponsorDrawState.drawType === "slot" && (
              <div className="bg-slate-50 border-4 border-slate-800 rounded-2xl py-8 overflow-hidden relative shadow-inner mb-6">
                {sponsorDrawState.isRolling ? (
                  <div className="text-5xl font-black text-slate-800 tracking-widest animate-slot-spin absolute inset-0 flex items-center justify-center">
                    {sponsorDrawState.name}
                  </div>
                ) : (
                  <div className="text-5xl font-black text-amber-500 tracking-widest animate-in zoom-in-50 duration-500 drop-shadow-md">
                    {sponsorDrawState.result}
                  </div>
                )}
              </div>
            )}

            {/* 動畫類型 2：生死四宮格 (Grid) */}
            {sponsorDrawState.drawType === "grid" && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {sponsorDrawState.candidates.map((c) => (
                  <div
                    key={c}
                    className={`py-6 rounded-2xl text-2xl font-black transition-all duration-75 flex items-center justify-center 
                      ${
                        sponsorDrawState.name === c
                          ? "bg-amber-500 text-white scale-105 shadow-[0_10px_20px_rgba(245,158,11,0.4)] z-10"
                          : "bg-slate-100 text-slate-300 scale-95"
                      }`}
                  >
                    {c}
                  </div>
                ))}
              </div>
            )}

            {/* 動畫類型 3：心跳聚光燈 (Spotlight) */}
            {sponsorDrawState.drawType === "spotlight" && (
              <div className="flex justify-center items-center h-32 bg-slate-50 rounded-[2rem] border-4 border-slate-800 shadow-inner relative overflow-hidden mb-6">
                {sponsorDrawState.isRolling ? (
                  <div className="text-5xl font-black text-slate-800 tracking-widest animate-pulse scale-125 transition-transform duration-75">
                    {sponsorDrawState.name}
                  </div>
                ) : (
                  <div className="text-5xl font-black text-amber-500 tracking-widest animate-bounce drop-shadow-md">
                    {sponsorDrawState.result}
                  </div>
                )}
              </div>
            )}

            {sponsorDrawState.drawType === "secret" &&
              !sponsorDrawState.result && (
                <div className="mb-6 rounded-[2rem] border border-rose-100 bg-rose-50 p-4 text-left">
                  <p className="text-sm font-bold text-rose-700 mb-1">
                    終極密碼 / 比大小
                  </p>
                  <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                    系統已經選好 1 到 100 的秘密數字，請現場每位參與者輸入名字與數字。
                  </p>
                  <div className="space-y-3">
                    {sponsorDrawState.secretGuesses.map((entry, index) => (
                      <div key={`${entry.name}-${index}`} className="flex gap-2">
                        <input
                          type="text"
                          value={entry.name}
                          onChange={(e) =>
                            setSponsorDrawState((prev) => {
                              const nextGuesses = [...prev.secretGuesses];
                              nextGuesses[index] = {
                                ...nextGuesses[index],
                                name: e.target.value,
                              };
                              return { ...prev, secretGuesses: nextGuesses };
                            })
                          }
                          className="flex-1 rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none"
                          placeholder="名字"
                        />
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={entry.guess}
                          onChange={(e) =>
                            setSponsorDrawState((prev) => {
                              const nextGuesses = [...prev.secretGuesses];
                              nextGuesses[index] = {
                                ...nextGuesses[index],
                                guess: e.target.value,
                              };
                              return { ...prev, secretGuesses: nextGuesses };
                            })
                          }
                          className="w-24 rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none"
                          placeholder="1-100"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={submitSecretLuckyDraw}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-rose-400 to-pink-500 py-3 text-sm font-bold text-white shadow-md active:scale-95"
                  >
                    公布結果
                  </button>
                </div>
              )}

            {sponsorDrawState.result && (
              <div className="mt-8 animate-in slide-in-from-bottom-4">
                <p className="font-bold text-slate-600 text-lg mb-2">
                  恭喜{" "}
                  <span className="text-amber-500 font-black">
                    {sponsorDrawState.result}
                  </span>{" "}
                  🎉
                </p>
                <p className="text-xs text-slate-400">
                  {sponsorDrawState.pendingPrize
                    ? "已連同獎品一起存入百寶袋！"
                    : "系統已自動記錄至金主光榮榜"}
                </p>
                {sponsorDrawState.secretWinner && (
                  <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    秘密數字：{sponsorDrawState.secretNumber}，最接近的是{" "}
                    {sponsorDrawState.secretWinner.name}（選了{" "}
                    {sponsorDrawState.secretWinner.guess}）。
                  </div>
                )}
                <button
                  onClick={closeSponsorDraw}
                  className="mt-6 w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-md active:scale-95"
                >
                  感謝乾爹 / 乾媽！
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 妹妹的百寶袋 Modal */}
      {showPrizeBag && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
          <div className="bg-[#fcfbf7] rounded-[2rem] w-full max-w-md h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8">
            <div className="bg-gradient-to-r from-rose-400 to-pink-500 p-5 pb-6 text-white relative">
              <button
                onClick={() => setShowPrizeBag(false)}
                className="absolute top-5 right-5 text-white/80 hover:text-white bg-black/10 rounded-full p-1.5 active:scale-90"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-black flex items-center gap-2">
                <Gift size={24} /> 妹妹的百寶袋
              </h2>
              <p className="text-rose-100 text-sm mt-1">
                專屬生日大獎都在這裡！找 Candy 兌換吧！
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
              {sisterPrizes.length === 0 ? (
                <div className="text-center text-slate-400 mt-10 font-bold">
                  目前空空如也，趕快去波上宮抽籤吧！
                </div>
              ) : (
                sisterPrizes.map((prize) => (
                  <div
                    key={prize.id}
                    className={`p-4 rounded-2xl border-2 transition-all ${prize.status === "redeemed" ? "bg-slate-50 border-slate-200 grayscale opacity-60" : "bg-white border-rose-200 shadow-sm"}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-extrabold text-slate-800 text-lg">
                        {prize.title}
                      </h3>
                      {prize.status === "redeemed" ? (
                        <span className="bg-slate-200 text-slate-500 text-xs font-bold px-2 py-1 rounded-md">
                          已使用
                        </span>
                      ) : (
                        <span className="bg-rose-100 text-rose-600 text-xs font-bold px-2 py-1 rounded-md animate-pulse">
                          可兌換
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-rose-500 mb-2 leading-relaxed flex items-center flex-wrap gap-2">
                      {prize.prize}
                      {/* 顯示被抽中的金主 */}
                      {prize.sponsor && (
                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-md border border-amber-200 shrink-0">
                          付款金主：{prize.sponsor}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-4">{prize.desc}</p>

                    {prize.status !== "redeemed" && (
                      <button
                        onClick={() =>
                          setRedeemState({
                            isOpen: true,
                            prizeId: prize.id,
                            code: "",
                          })
                        }
                        className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-xl shadow-md active:scale-95 text-sm"
                      >
                        👉 找 Candy 兌換
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <header className="bg-gradient-to-r from-[#93C5FD] to-[#A5F3FC] p-5 rounded-b-3xl shadow-sm sticky top-0 z-40">
        <div className="flex justify-between items-center text-slate-800">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-wider flex items-center gap-1.5">
              🌺 沖繩家族旅行
              {/* 測試按鈕：隨時解鎖 5/13 的生日與百寶袋權限 */}
              <button
                onClick={() => {
                  setIsBirthdayActive(true);
                  setShowBirthday(true);
                }}
                className="bg-white/30 hover:bg-white/50 p-1.5 rounded-full backdrop-blur-sm transition-colors active:scale-90"
                title="測試生日彩蛋"
              >
                <Gift size={14} className="text-rose-500" />
              </button>
            </h1>
          </div>

          <div className="flex gap-2">
            {/* 百寶袋入口 (僅生日當天或按下測試按鈕後顯示) */}
            {isBirthdayActive && (
              <button
                onClick={() => setShowPrizeBag(true)}
                className="bg-rose-500 text-white p-2 rounded-xl shadow-md active:scale-95 flex items-center justify-center relative"
              >
                <Gift size={20} />
                {sisterPrizes.filter((p) => p.status === "available").length >
                  0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-rose-500 animate-ping"></span>
                )}
              </button>
            )}

            <div
              onClick={() => setActiveTab("accounting")}
              className="bg-white/40 backdrop-blur-md px-3 py-2 rounded-xl flex items-center gap-2 cursor-pointer border border-white/50 shadow-sm active:scale-95"
            >
              <PiggyBank size={20} className="text-amber-500" />
              <div className="text-right">
                <p className="text-[9px] font-bold text-slate-600">總花費</p>
                <p className="font-extrabold text-sm">
                  {currency === "JPY"
                    ? `¥${totalPublicSpent.toLocaleString()}`
                    : `NT$ ${Math.round(totalPublicSpentTWD).toLocaleString()}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main
        id="main-scroll"
        className="pb-28 overflow-y-auto h-[calc(100vh-80px)] relative"
      >
        {activeTab === "itinerary" && (
          <ItineraryView
            weatherData={weatherData}
            getWeatherIcon={getWeatherIcon}
            rooms={rooms}
            setRooms={setRooms}
            usedTickets={usedTickets}
            onToggleUsedTicket={handleToggleUsedTicket}
            startSponsorDraw={startSponsorDraw}
            startLuckyDraw={startLuckyDraw}
            canUseBirthdaySurprise={isBirthdaySurpriseAvailable}
            isBirthdayActive={isBirthdayActive}
            sisterPrizes={sisterPrizes}
          />
        )}
        {activeTab === "accounting" && (
          <div className="p-4">
            <AccountingView
              expenses={expenses}
              currency={currency}
              setCurrency={setCurrency}
              formatTWD={formatTWD}
              showExpenseForm={showExpenseForm}
              setShowExpenseForm={setShowExpenseForm}
              expenseForm={expenseForm}
              setExpenseForm={setExpenseForm}
              handleSaveExpense={handleSaveExpense}
              handleDeleteExpense={handleDeleteExpense}
              handleToggleSplitMember={handleToggleSplitMember}
              handleEditExpense={handleEditExpense}
              handleCloseForm={handleCloseForm}
              editingId={editingId}
              sponsorDraws={sponsorDraws}
              startSponsorDraw={startSponsorDraw}
              startLuckyDraw={startLuckyDraw}
              exchangeRate={exchangeRate}
              handleOpenForm={handleOpenForm}
            />
          </div>
        )}
        {activeTab === "flights" && (
          <div className="p-4">
            <FlightsView />
          </div>
        )}
        {activeTab === "shopping" && (
          <div className="p-4">
            <ShoppingView />
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 w-full max-w-md bg-white/95 backdrop-blur-lg border-t border-slate-200 flex justify-around p-3 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-3xl z-40">
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
          icon={<ShoppingBag />}
          label="購物優惠"
          isActive={activeTab === "shopping"}
          onClick={() => setActiveTab("shopping")}
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

function LegacyNavItem({ icon, label, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center transition-all duration-300 ${isActive ? "text-sky-600 scale-110" : "text-slate-400 hover:text-sky-500"}`}
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

// --- 行程畫面模組 ---
function LegacyItineraryView({
  weatherData,
  getWeatherIcon,
  rooms,
  setRooms,
  usedTickets,
  setUsedTickets,
  startSponsorDraw,
  isBirthdayActive,
  sisterPrizes,
}) {
  const [selectedOptions, setSelectedOptions] = useState(null);
  const [activeDay, setActiveDay] = useState(0);
  const [isEditingRooms, setIsEditingRooms] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);

  const [omikujiState, setOmikujiState] = useState({
    isOpen: false,
    step: null,
    result: null,
  });

  const OMIKUJI_POOL = {
    大吉: {
      title: "🌸 大吉 🌸",
      color: "text-rose-500",
      bg: "from-rose-50 to-rose-100 border-rose-300",
      desc: "「恭喜成為本次沖繩財運之神！」",
      prizes: [
        "🎉 下一餐免單券 (請大聲呼叫本團金主買單)",
        "🍣 壽司自由點一盤 (可指定一盤高級壽司，大家不能阻止你)",
        "🧋 全家飲料王 (全員飲料由一位幸運金主贊助)",
        "🎁 神秘扭蛋權 (可指定任何一位家人幫你買一個扭蛋)",
        "💴 ¥1600 旅遊基金 (一人400元，旅途中可直接使用)",
        "👑 壽星神權 (今天任何人不能拒絕你的一次要求)",
      ],
    },
    中吉: {
      title: "✨ 中吉 ✨",
      color: "text-orange-500",
      bg: "from-orange-50 to-orange-100 border-orange-300",
      desc: "運氣很不錯喔！開心出遊最重要！",
      prizes: [
        "🍗 獲得 LAWSON 炸雞券一份",
        "📸 指定拍照權 (可以指定全家配合拍一張奇怪姿勢照片)",
        "🛍️ 便利商店零食券 ¥300",
        "☕ 免費飲料券 (飲料免費一杯)",
        "🧸 沖繩小物 ¥300 (今天看到喜歡的都買，不准阻止)",
      ],
    },
    小吉: {
      title: "🍀 小吉 🍀",
      color: "text-teal-500",
      bg: "from-teal-50 to-teal-100 border-teal-300",
      desc: "充滿小確幸的一天！",
      prizes: [
        "🍫 小零食基金 ¥100",
        "📷 擔任今日幸運攝影師 (負責幫大家拍好看的照片)",
        "🫶 獲得全家稱讚一次 (大家必須誇你一句)",
        "🍬 糖果 / 軟糖隨機獎勵一份",
        "✨ 今日運氣加成 (下次抽籤可重抽一次)",
      ],
    },
    隱藏彩蛋: {
      title: "🤣 隱藏彩蛋 🤣",
      color: "text-purple-600",
      bg: "from-purple-50 to-purple-100 border-purple-300",
      desc: "這才是旅程最棒的回憶 (大凶1%)",
      prizes: [
        "💀 今天負責導航 (但其實導航超容易迷路)",
        "🦁 沖繩獅子守護者 (必須跟一隻風獅爺合照)",
        "👯 全家指定 pose 拍照 (抽到的人要負責設計 pose)",
      ],
    },
  };

  const drawOmikuji = () => {
    setOmikujiState({ isOpen: true, step: "shaking", result: null });

    let roll = Math.random() * 100;
    let rank = roll < 50 ? "大吉" : roll < 85 ? "中吉" : "小吉";

    let availablePrizes = [...OMIKUJI_POOL[rank].prizes];
    if (rank === "大吉") {
      const has1600Won = sisterPrizes.some(
        (p) => p.prize && p.prize.includes("¥1600 旅遊基金"),
      );
      if (has1600Won) {
        availablePrizes = availablePrizes.filter(
          (p) => !p.includes("¥1600 旅遊基金"),
        );
      }
    }

    const prize =
      availablePrizes[Math.floor(Math.random() * availablePrizes.length)];
    const resultObj = { ...OMIKUJI_POOL[rank], prize };

    setTimeout(() => {
      setOmikujiState((prev) => ({ ...prev, step: "falling" }));
      setTimeout(() => {
        setOmikujiState((prev) => ({
          ...prev,
          step: "result",
          result: resultObj,
        }));
      }, 1200);
    }, 1500);
  };

  const handleAcceptPrize = async () => {
    try {
      const firestore = getDbOrThrow();
      await addDoc(collection(firestore, "sister_prizes"), {
        title: omikujiState.result.title,
        desc: omikujiState.result.desc,
        prize: omikujiState.result.prize,
        status: "available",
        createdAt: Date.now(),
      });
      setOmikujiState({ isOpen: false, step: null, result: null });
    } catch (err) {
      alert("儲存失敗：" + err.message);
    }
  };

  const handleSaveRooms = async () => {
    setIsEditingRooms(false);
    try {
      const firestore = getDbOrThrow();
      await setDoc(doc(firestore, "shared_data", "rooms"), rooms);
    } catch (error) {
      alert("儲存房號失敗，請檢查網路連線。");
    }
  };

  // 🚀 核心日期檢查邏輯：5月11日才解鎖門票，或啟用測試模式時解鎖
  const today = new Date();
  const isTicketUnlockDay =
    (today.getMonth() === 4 && today.getDate() === 11) || isBirthdayActive;

  const tripDates = [
    {
      id: 0,
      title: "DAY 1",
      date: "1/21",
      realDate: "5/10",
      fullDate: "2026-05-10",
    },
    {
      id: 1,
      title: "DAY 2",
      date: "1/22",
      realDate: "5/11",
      fullDate: "2026-05-11",
    },
    {
      id: 2,
      title: "DAY 3",
      date: "1/23",
      realDate: "5/12",
      fullDate: "2026-05-12",
    },
    {
      id: 3,
      title: "DAY 4",
      date: "1/24",
      realDate: "5/13",
      fullDate: "2026-05-13",
    },
    {
      id: 4,
      title: "DAY 5",
      date: "1/25",
      realDate: "5/14",
      fullDate: "2026-05-14",
    },
    {
      id: 5,
      title: "DAY 6",
      date: "1/26",
      realDate: "5/15",
      fullDate: "2026-05-15",
    },
  ];

  const scrollToDay = (index) => {
    setActiveDay(index);
    const element = document.getElementById(`day-${index}`);
    const mainScroll = document.getElementById("main-scroll");
    if (element && mainScroll) {
      const topOffset = element.offsetTop - 100;
      mainScroll.scrollTo({ top: topOffset, behavior: "smooth" });
    }
  };

  const itineraryData = [
    {
      title: "抵達與北谷美國村",
      items: [
        {
          type: "flight",
          time: "12:20",
          title: "抵達 OKA",
          desc: "前往租車接送點",
        },
        {
          type: "spot",
          time: "13:00",
          title: "取車 (三菱 Delica)",
          desc: "自駕，尋找大型停車場",
        },
        {
          type: "spot",
          time: "15:00",
          title: "蒙帕公寓式飯店 Check-in",
          desc: "約40分車程，美國村旁",
        },
        {
          type: "food",
          time: "午餐",
          title: "午餐 (3家備案選1)",
          desc: "點擊查看選項",
          options: [
            {
              name: "泊港漁市場",
              desc: "推薦現切鮪魚。大國海產、中真水產有代客料理+內用座位。",
              map: "https://maps.google.com/?q=泊港漁市場",
              img: "/food/fishMarket.jpg",
            },
            {
              name: "A&W Makiminato",
              desc: "停好車在車上點餐！推薦：The A&W Burger、麥根沙士、捲薯條。",
              map: "https://maps.google.com/?q=A&W+Makiminato",
              img: "/food/A&W.jpg",
            },
            {
              name: "Tonkatsu Taro Chatan Branch",
              desc: "25公分巨大炸蝦！",
              map: "https://maps.google.com/?q=Tonkatsu+Taro+Chatan",
              img: "/food/shrimp.jpg",
            },
          ],
        },
        {
          type: "spot",
          time: "下午",
          title: "美國村 (American Village)",
          desc: "點擊查看必吃必逛清單",
          options: [
            {
              name: "Cheesus cafe",
              desc: "必吃熱騰騰烤起司三明治！",
              map: "https://maps.google.com/?q=Cheesus+cafe+北谷",
              img: "/food/cheeseUs.jpg",
            },
            {
              name: "焼き芋 自動販売機",
              desc: "超特別！路邊熱騰騰烤地瓜自動販賣機",
              map: "https://maps.google.com/?q=北谷+烤地瓜販賣機",
              img: "/food/atm.png",
            },
            {
              name: "GIGO 北谷",
              desc: "夾娃娃機、扭蛋天堂",
              map: "https://maps.google.com/?q=GIGO+北谷",
              img: "/source/gigo.jpg",
            },
            {
              name: "Blue Seal (北谷店)",
              desc: "營業 11:00–21:00。推薦沖繩鹽餅乾 / 紅芋冰，海景第一排吃冰淇淋！",
              map: "https://maps.google.com/?q=Blue+Seal+北谷",
            },
          ],
        },
        {
          type: "food",
          time: "晚餐",
          title: "晚餐選項",
          desc: "點擊查看選項",
          options: [
            {
              name: "迴轉壽司市場 美浜店",
              desc: "人氣平價迴轉壽司",
              map: "https://maps.google.com/?q=迴轉壽司市場+美浜店",
              img: "/food/cycleSushi.jpg",
            },
            {
              name: "歩炉 北谷店",
              desc: "營業 16:00–23:00。推薦：串燒、肥鮪魚捲、10塊烤肉拼盤",
              map: "https://maps.google.com/?q=歩炉+北谷店",
              img: "/food/yakitori.png",
            },
          ],
        },
      ],
    },
    {
      title: "古宇利島 + 水族館",
      items: [
        {
          type: "spot",
          time: "08:30",
          title: "出發前往北部",
          desc: "早點出發避車潮",
        },
        {
          type: "food",
          time: "上午",
          title: "⭐ 許田休息站",
          desc: "點擊查看必吃美食",
          options: [
            {
              name: "許田休息站",
              desc: "日本第一名道の駅！營業時間：08:30–19:00",
              map: "https://maps.google.com/?q=許田休息站",
            },
            {
              name: "琉球銘菓 三矢",
              desc: "必吃：三矢本舖的沖繩傳統炸甜甜圈「沙翁」",
              map: "https://maps.google.com/?q=琉球銘菓+三矢",
            },
          ],
        },
        {
          type: "spot",
          time: "10:00",
          title: "古宇利島",
          desc: "點擊查看景點與美食",
          options: [
            {
              name: "古宇利大橋",
              desc: "必拍絕美海景。",
              map: "https://maps.app.goo.gl/y9uHJg2Kos4TC52P8",
              img: "/kouriBridge.jpg",
            },
            {
              name: "心型岩",
              desc: "必拍心型礁岩。",
              map: "https://maps.google.com/?q=古宇利島心型岩",
              img: "/heartRock.jpg",
            },
            {
              name: "KOURI SHRIMP (蝦蝦飯)",
              desc: "營業時間 11:00 - 16:00。古宇利島必吃夏威夷蒜香蝦蝦飯！",
              map: "https://maps.google.com/?q=KOURI+SHRIMP",
              img: "/food/kouri-shrimp.jpg",
            },
            {
              name: "Shinmei Coffee",
              desc: "營業時間 10:30 - 16:30。大推現刨生黑糖拿鐵，生黑糖珍珠鮮奶茶！",
              map: "https://maps.google.com/?q=Shinmei+Coffee",
              note: "⚠️ 僅收現金或電子支付，不可刷信用卡",
            },
          ],
        },
        {
          type: "info",
          time: "13:00",
          title: "美麗海水族館",
          desc: "園區詳細資訊與電子門票",
          options: [
            {
              name: "🚗 停車場資訊",
              desc: "園內 9 個停車場皆免費！\n優先尋找「大型停車場」停放。",
              img: "/source/aquarium.png",
            },
            {
              name: "🎫 入場電子門票 - 爸爸",
              desc: "請準備好手機刷 QR Code 入場。",
              isTicket: true,
              id: "ticket-papa",
              img: "/tickets/ticket0.jpg",
            },
            {
              name: "🎫 入場電子門票 - 媽媽",
              desc: "請準備好手機刷 QR Code 入場。",
              isTicket: true,
              id: "ticket-mama",
              img: "/tickets/ticket1.jpg",
            },
            {
              name: "🎫 入場電子門票 - 妹妹",
              desc: "請準備好手機刷 QR Code 入場。",
              isTicket: true,
              id: "ticket-sister",
              img: "/tickets/ticket2.jpg",
            },
            {
              name: "🎫 入場電子門票 - 書瑋",
              desc: "請準備好手機刷 QR Code 入場。",
              isTicket: true,
              id: "ticket-shuwei",
              img: "/tickets/ticket3.jpg",
            },
            {
              name: "🎫 入場電子門票 - Candy",
              desc: "請準備好手機刷 QR Code 入場。",
              isTicket: true,
              id: "ticket-candy",
              img: "/tickets/ticket4.jpg",
            },
            {
              name: "🐬 海豚秀時間表 (戶外展區)",
              desc: "表演時間：\n10:30 / 11:30 / 13:00 / 14:30 / 16:00 / 17:00",
              note: "建議提前 15 分鐘去卡位！",
            },
            {
              name: "🐟 海豚餵食體驗 (海豚館)",
              desc: "體驗費用：500日圓 / 1份\n付款方式：僅接受信用卡\n\n【每日場次】\n① 10:00～10:30\n② 11:00～11:30\n③ 12:00～12:30\n④ 13:30～14:00\n⑤ 15:30～16:00",
              note: "※ 每人最多限購 5 份",
            },
            {
              name: "🐋 黑潮之海 鯨鯊餵食秀",
              desc: "表演時間：\n15:00 / 17:00",
              note: "在室內的主水槽區",
            },
          ],
        },
        {
          type: "spot",
          time: "傍晚",
          title: "回程停留",
          desc: "點擊查看回程推薦",
          options: [
            {
              name: "星巴克 名護21世紀之森公園店",
              desc: "特色水果星冰樂！風景優美的休息站。",
              map: "https://maps.google.com/?q=星巴克+名護21世紀之森公園",
            },
            {
              name: "海人料理 亀ぬ浜",
              desc: "營業時間 17:00 - 21:00。晚餐好去處。",
              map: "https://maps.google.com/?q=海人料理+亀ぬ浜",
            },
          ],
        },
      ],
    },
    {
      title: "北谷 → 那霸 (中部往南)",
      items: [
        {
          type: "spot",
          time: "10:00",
          title: "退房與移動",
          desc: "前往那霸市區",
        },
        {
          type: "food",
          time: "午餐",
          title: "途中美食大搜查",
          desc: "點擊查看美食清單",
          options: [
            {
              name: "港川外人住宅雞湯拉麵屋 いしぐふ",
              desc: "初代沖繩麵王！招牌 Tokusen soba（綜合雞肉拉麵）, 椒鹽雞肉/滷汁雞肉。\n套餐是多一小碗的飯（溫泉蛋拌飯、雞湯汁拌飯、烤雞肉拌飯三選一）",
              map: "https://maps.google.com/?q=いしぐふ+港川",
              img: "/food/TokusenSoba.jpg",
            },
            {
              name: ".uki",
              desc: "營業時間 7:00 - 17:00，杯測冠軍！",
              map: "https://maps.google.com/?q=.uki+okinawa",
            },
            {
              name: "A&W Makiminato",
              desc: "路上經過，特色是停好車可以在車上點餐，店員會送來。",
              map: "https://maps.google.com/?q=A&W+Makiminato",
            },
            {
              name: "COCOROAR CAFE",
              desc: "招牌甜點是使用「下川六〇酵素卵」與米粉製作的鬆餅。",
              map: "https://maps.google.com/?q=COCOROAR+CAFE",
            },
            {
              name: "Okinawa Cerrado Coffee",
              desc: "超讚手沖咖啡",
              map: "https://maps.google.com/?q=Okinawa+Cerrado+Coffee",
            },
            {
              name: "oHacorte 港川店",
              desc: "超美特色水果塔，起司塔/草莓塔。",
              map: "https://maps.google.com/?q=oHacorte+港川店",
              img: "/food/cheeseTart.jpg",
            },
            {
              name: "Houki Boshi",
              desc: "必買黑糖可麗露，黑糖星星餅乾。",
              map: "https://maps.google.com/?q=Houki+Boshi",
              img: "/food/brownSugarCookie.jpg",
            },
          ],
        },
        {
          type: "spot",
          time: "15:00",
          title: "Hotel Urbansea 2 Check-in",
          desc: "國際通附近",
        },
        {
          type: "shopping",
          time: "下午",
          title: "國際通採買",
          desc: "點擊查看必買伴手禮與點心",
          options: [
            {
              name: "松原屋製菓",
              desc: "必買：沙翁 (沖繩傳統炸甜甜圈)，營業時間 09:00–18:00。",
              map: "https://maps.google.com/?q=松原屋製菓",
              img: "/food/donut.jpg",
            },
            {
              name: "福助玉子燒",
              desc: "必吃：玉子燒飯糰。",
              map: "https://maps.google.com/?q=福助玉子燒+那霸",
            },
            {
              name: "Mochi-no-mise Yamaya",
              desc: "沖繩傳統麻糬專賣店，沖繩麻糬/沖繩草仔粿。",
              map: "https://maps.google.com/?q=Mochi-no-mise+Yamaya",
              img: "/food/okinawamochi.jpg",
            },
            {
              name: "琉球牛乳餅",
              desc: "鮮奶麻糬（類似炸牛奶/蕨餅口感），特色口味包括原味、紫薯、紅糖。",
              map: "https://maps.google.com/?q=琉球牛乳餅",
              img: "/food/milk_ricecake.jpg",
            },
            {
              name: "Hama Shokhuin",
              desc: "推薦：花生豆腐。",
              map: "https://maps.google.com/?q=Hama+Shokhuin",
            },
            {
              name: "Maxi Pudding",
              desc: "推薦：茉莉花茶、沖繩咖啡、蔗糖口味的生布丁。\n以急速冷凍封存代替烘焙，做出如同奶昔般的口感。",
              map: "https://maps.google.com/?q=Maxi+Pudding+那霸",
            },
            {
              name: "Jisakasu",
              desc: "充滿特色的在地二手小店。",
              map: "https://maps.google.com/?q=Jisakasu+okinawa",
            },
            {
              name: "BURGER TIME",
              desc: "BLT酪梨起司漢堡 推薦！",
              map: "https://maps.google.com/?q=BURGER+TIME+那霸",
            },
            {
              name: "Calbee+",
              desc: "現炸薯條跟馬鈴薯吉拿棒",
              map: "https://maps.google.com/?q=Calbee+那霸",
            },
            {
              name: "風獅爺燒",
              desc: "沖繩在地特色風獅爺雞蛋糕",
              map: "https://maps.google.com/?q=風獅爺燒",
            },
          ],
        },
        {
          type: "food",
          time: "晚餐",
          title: "晚餐選項 (擇一)",
          desc: "點擊查看",
          options: [
            {
              name: "國際通屋台村",
              desc: "從飯店走路只要 8 分鐘",
              map: "https://maps.google.com/?q=國際通屋台村",
            },
            {
              name: "Okiraku",
              desc: "好吃的關東煮，類似居酒屋",
              map: "https://maps.google.com/?q=Okiraku+okinawa",
            },
            {
              name: "鳥貴族",
              desc: "營業時間 17:00–01:00。備案：高CP值串燒",
              map: "https://maps.google.com/?q=鳥貴族+那霸",
            },
          ],
        },
      ],
    },
    {
      title: "神社與市區採買",
      items: [
        {
          type: "food",
          time: "早餐",
          title: "早餐 2 選 1",
          desc: "點擊查看",
          options: [
            {
              name: "Marutama味噌飯屋",
              desc: "營業時間 07:30–10:00。160多年老店，推薦肉味增納豆/味增湯定食。",
              map: "https://maps.google.com/?q=Marutama味噌飯屋",
            },
            {
              name: "おにぎり屋 縁むすび",
              desc: "營業時間 08:00–09:30。日式飯糰",
              map: "https://maps.google.com/?q=おにぎり屋+縁むすび",
            },
          ],
        },
        {
          type: "spot",
          time: "上午",
          title: "波上宮",
          desc: "點擊查看參拜步驟與注意事項",
          options: [
            {
              name: "波上宮參拜須知",
              desc: "還御守。御守授與時間為 9:00～17:00\n\n【淨化儀式：手水舍】\n參拜前，請先在入口處的「手水舍」進行淨手淨口：\n1. 用勺子舀水清洗左手、右手。\n2. 用左手漱口。\n3. 將勺子直立，讓剩餘的水流下清洗勺柄。\n\n【參拜流程】\n1. 投幣（5円）\n2. 搖鈴\n3. 二拜二拍（深深鞠躬兩次，拍手兩下，以示尊敬。）\n4. 合掌祈禱\n5. 一拜",
              map: "https://maps.google.com/?q=波上宮",
              isOmikuji: true,
            },
          ],
        },
        {
          type: "food",
          time: "咖啡",
          title: "參拜後咖啡休息",
          desc: "點擊查看",
          options: [
            {
              name: "TURNER COFFEE",
              desc: "營業時間 10:30–17:00。推薦：Oat Milk Latte (燕麥奶拿鐵)",
              map: "https://maps.google.com/?q=TURNER+COFFEE",
            },
            {
              name: "Aguro Baisen Coffee",
              desc: "營業時間 09:00–18:00。推薦：培根蛋吐司和冰咖啡套餐。",
              map: "https://maps.google.com/?q=Aguro+Baisen+Coffee",
              note: "⚠️ 此店家僅接受現金付款",
            },
          ],
        },
        {
          type: "spot",
          time: "下午",
          title: "波之上海空公園 & 購物",
          desc: "波之上海空公園、無印良品 那霸Main Place店、壺屋通\n第一牧志公設市場 (8:00~22:00) 大城屋",
          options: [
            {
              name: "波之上海空公園",
              desc: "在海邊放鬆散步，欣賞美麗海景。",
              map: "https://maps.google.com/?q=波之上海空公園",
            },
            {
              name: "無印良品 (那霸 Main Place店)",
              desc: "大型購物商場內，好買好逛。",
              map: "https://maps.google.com/?q=無印良品+那霸Main+Place",
            },
            {
              name: "壺屋通",
              desc: "沖繩傳統陶器街，很適合文青散步買紀念品。",
              map: "https://maps.google.com/?q=壺屋通",
            },
            {
              name: "第一牧志公設市場",
              desc: "營業時間 8:00-22:00。沖繩的廚房，推薦尋找隱藏美味「大城屋」。",
              map: "https://maps.google.com/?q=第一牧志公設市場",
            },
          ],
        },
        {
          type: "food",
          time: "17:00",
          title: "晚餐：琉球之牛",
          desc: "點擊查看訂位資訊與備註",
          options: [
            {
              name: "琉球之牛 & 唐吉訶德",
              desc: "牛舌推薦，可以直接點套餐。\n吃完後逛唐吉訶德 那霸壺川店 (人少走道寬好逛)\n\n🛒 伴手禮推薦：請至「購物優惠」頁面查看願望清單！",
              map: "https://maps.google.com/?q=琉球之牛+那霸",
              note: "🚨 預約確認號碼：5C2H4G！遲到15分鐘會直接取消！",
            },
          ],
        },
      ],
    },
    {
      title: "美食與購物日",
      items: [
        {
          type: "food",
          time: "07:00",
          title: "早餐 2 選 1",
          desc: "點擊查看地圖",
          options: [
            {
              name: "Furinkazan 風林火山",
              desc: "營業時間 07:00–11:00 (周三公休)。日式特色早餐。",
              map: "https://maps.google.com/?q=風林火山+那霸",
              img: "/food/furinkazhan.jpg",
            },
            {
              name: "Haruchii",
              desc: "特色肉卷飯糰",
              map: "https://maps.google.com/?q=Haruchii+那霸",
              img: "/food/haruchii.jpg",
            },
          ],
        },
        {
          type: "spot",
          time: "上午",
          title: "首里城 行程",
          desc: "點擊查看參觀路線",
          options: [
            {
              name: "首里城公園",
              desc: "門票：成人 400 日幣，6歲以下免費。\n\n【參觀重點路線】\n• 守禮門\n• 園比屋武御嶽石門 (國王祈願祭拜所)\n• 歡會門 (歡迎受邀前來的中國皇帝使節)\n• 瑞泉門\n• 首里杜館\n• 奉神門\n• 首里城正殿 (國家歷史遺址)\n• 東之物見台 (眺望風景的瞭望台)",
              map: "https://maps.google.com/?q=首里城",
            },
          ],
        },
        {
          type: "food",
          time: "午餐",
          title: "漁師食堂 (大ばんぶる舞)",
          desc: "點擊查看完整菜單",
          options: [
            {
              name: "🐟 生食推薦菜單",
              desc: "• 肥美赤甜蝦刺身(2尾) ¥380\n• 生食級生蠔佐醋醬(1個) ¥280\n• 增量漁師丼 OR 增量蔥鮪丼 (霸氣) ¥1,290\n• 定番海鮮丼(附醋飯)定食 只要 ¥1,080",
              map: "https://maps.google.com/?q=大ばんぶる舞",
            },
            {
              name: "🍤 熟食推薦菜單",
              desc: "• 大ばんぶる舞鰻魚丼 約¥2,380\n• 炸蝦丼 (えびだけ丼)\n• 厚切炸竹筴魚定食 (アジフライ定食)\n• 煎魚定食 (魚の煮付け / 焼き魚)\n• 魚湯定食 (船上の魚汁) 👉 熱湯，OK\n• 鮪魚排咖哩 (鮪カツカレー) 👉 熟炸",
              map: "https://maps.google.com/?q=大ばんぶる舞",
              img: "/food/巨大鰻魚飯.jpg",
            },
          ],
        },
        {
          type: "shopping",
          time: "下午",
          title: "市區逛街 & 瀨長島",
          desc: "點擊查看行程選項",
          options: [
            {
              name: "hoppepan",
              desc: "營業 10:00–19:00 (二,三休息)。必買：明太子法國麵包、炸蝦堡！",
              map: "https://maps.google.com/?q=hoppepan",
            },
            {
              name: "UNIQLO",
              desc: "天久店 或 那霸店",
              map: "https://maps.google.com/?q=UNIQLO+Ryubo+Ameku+Rakuichi",
            },
            {
              name: "無印良品 (天久店)",
              desc: "天久購物區的無印良品",
              map: "https://maps.google.com/?q=無印良品+天久",
            },
            {
              name: "無印良品 (Palette久茂地店)",
              desc: "位於久茂地的無印良品分店",
              map: "https://maps.google.com/?q=無印良品+Palette久茂地店",
            },
            {
              name: "瀨長島 (沖繩小希臘)",
              desc: "瀨長島海風露台、子寶岩、瀨長島日落公園、瀨長海灘",
              map: "https://maps.google.com/?q=瀨長島",
            },
          ],
        },
        {
          type: "food",
          time: "晚餐",
          title: "晚餐選項",
          desc: "點擊查看",
          options: [
            {
              name: "傑克牛排館 (Jack's Steak House)",
              desc: "營業時間 11:00 - 22:30 (星期三休息)。沖繩經典老字號美式牛排館。",
              map: "https://maps.google.com/?q=傑克牛排館",
              img: "/food/jack-steak.jpg",
            },
            {
              name: "賴長島 (海風露台)",
              desc: "在瀨長島找間喜歡的異國料理看夜景吃晚餐",
              map: "https://maps.google.com/?q=瀨長島海風露台",
            },
            {
              name: "第一牧志公設市場",
              desc: "營業時間 8:00~22:00。\n\n(註：步沙翁營業時間為 11:00–17:00，周三周日公休)",
              map: "https://maps.google.com/?q=第一牧志公設市場",
            },
          ],
        },
      ],
    },
    {
      title: "賦歸",
      items: [
        {
          type: "food",
          time: "09:00",
          title: "BOULANGERIE BZ",
          desc: "點擊查看地圖",
          options: [
            {
              name: "BOULANGERIE BZ",
              desc: "營業時間 09:00–19:00。大推迷你可頌麵包，必買外帶回台！",
              map: "https://maps.google.com/?q=BOULANGERIE+BZ",
              img: "/food/crossant.jpg",
            },
          ],
        },
        {
          type: "food",
          time: "午餐",
          title: "琉球新麵 通堂 小祿本店",
          desc: "點擊查看推薦麵款",
          options: [
            {
              name: "琉球新麵 通堂 (小祿本店)",
              desc: "營業時間 11:00–23:30\n\n🍜 男人麵：豚骨湯，味道濃郁偏重口味，圓細麵。\n🍜 女人麵：雞高湯，味道清爽偏輕淡口味，扁細麵。",
              map: "https://maps.google.com/?q=琉球新麵+通堂+小祿本店",
            },
          ],
        },
        {
          type: "spot",
          time: "13:30",
          title: "抵達租車公司還車",
          desc: "滿油還車、保留加油收據！最晚 15:30 前要還車。\n建議 13:30 到租車公司，最晚 13:50 到並等接駁去機場。\n最好是 14:00 前到機場！",
        },
        {
          type: "flight",
          time: "16:50",
          title: "那霸起飛 (OKA)",
          desc: "17:30 抵達桃園 (TPE)",
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
      case "info":
        return <Info className="text-indigo-400" size={18} />;
      default:
        return <Map className="text-slate-400" size={18} />;
    }
  };

  const getModalIcon = (type, size = 20) => {
    if (type === "food")
      return <Utensils size={size} className="text-orange-400" />;
    if (type === "shopping")
      return <ShoppingBag size={size} className="text-rose-500" />;
    if (type === "info")
      return <Info size={size} className="text-indigo-400" />;
    return <MapPin size={size} className="text-teal-500" />;
  };

  return (
    <div className="min-h-screen bg-[#f3f8f9] font-sans max-w-md mx-auto shadow-2xl relative overflow-hidden text-slate-700">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-float { animation: float 3s ease-in-out infinite; }
        @keyframes shake-omikuji { 0%, 100% { transform: rotate(0deg) translateY(0); } 25% { transform: rotate(-15deg) translateY(-10px); } 50% { transform: rotate(15deg) translateY(5px); } 75% { transform: rotate(-15deg) translateY(-10px); } }
        .animate-shake-omikuji { animation: shake-omikuji 0.15s ease-in-out infinite; }
        @keyframes fall-stick { 0% { transform: translateY(-20px) rotate(180deg); opacity: 0; } 100% { transform: translateY(80px) rotate(180deg); opacity: 1; } }
        .animate-fall-stick { animation: fall-stick 0.8s ease-out forwards; }
        @keyframes fall-sakura { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(360deg); opacity: 0; } }
        @keyframes slot-spin { 0% { transform: translateY(-100%); opacity: 0; } 50% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(100%); opacity: 0; } }
        .animate-slot-spin { animation: slot-spin 0.1s linear infinite; }
      `}</style>

      {/* 自訂密碼兌換 Modal */}
      {redeemState.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() =>
              setRedeemState({ isOpen: false, prizeId: null, code: "" })
            }
          ></div>
          <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                <Key size={18} className="text-rose-500" /> 輸入兌換密碼
              </h3>
              <button
                onClick={() =>
                  setRedeemState({ isOpen: false, prizeId: null, code: "" })
                }
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-3 leading-relaxed">
              請將手機交給{" "}
              <span className="font-bold text-rose-500">Candy 姊姊</span>
              ，由她為你輸入專屬的魔法密碼解鎖獎品！
            </p>
            <input
              type="password"
              value={redeemState.code}
              onChange={(e) =>
                setRedeemState({ ...redeemState, code: e.target.value })
              }
              className="w-full border-2 border-slate-200 p-3.5 rounded-xl mb-5 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none text-center text-xl tracking-[0.5em] font-black text-slate-700"
              placeholder="••••"
              autoFocus
            />
            <button
              onClick={submitRedeemCode}
              className="w-full bg-gradient-to-r from-rose-400 to-pink-500 text-white font-bold py-3.5 rounded-xl shadow-md active:scale-95 transition-all"
            >
              確認兌換
            </button>
          </div>
        </div>
      )}

      {/* 妹妹生日驚喜卡片 */}
      {showBirthday && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>
          <div className="absolute top-0 left-0 w-full h-full opacity-60 bg-[radial-gradient(circle_at_50%_40%,_rgba(251,113,133,0.4),_transparent_70%)]"></div>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute text-pink-300 opacity-70"
                style={{
                  top: `${Math.random() * -20}%`,
                  left: `${Math.random() * 100}%`,
                  animation: `fall-sakura ${Math.random() * 3 + 3}s linear infinite`,
                  animationDelay: `${Math.random() * 2}s`,
                  fontSize: `${Math.random() * 10 + 10}px`,
                }}
              >
                🌸
              </div>
            ))}
          </div>
          <div className="relative w-[85%] max-w-sm bg-white/10 backdrop-blur-xl border border-white/40 rounded-[2.5rem] p-6 pb-8 shadow-[0_0_50px_rgba(244,63,94,0.3)] animate-in zoom-in-90 duration-500 flex flex-col items-center">
            <button
              onClick={() => setShowBirthday(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/20 p-2 rounded-full backdrop-blur-sm transition-all active:scale-90 z-10"
            >
              <X size={20} />
            </button>
            <div className="absolute -top-5 bg-gradient-to-r from-rose-400 to-pink-500 text-white font-black px-6 py-1.5 rounded-full shadow-lg border border-white/50 flex items-center gap-2 transform -rotate-3">
              <Gift size={16} className="animate-pulse" />
              <span className="tracking-wide">Surprise!</span>
            </div>
            <div className="w-40 h-40 mt-8 mb-6 relative animate-float">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-200 to-amber-500 rounded-full blur-xl opacity-50"></div>
              <div className="w-full h-full bg-white/20 rounded-full border-2 border-white/60 flex items-center justify-center shadow-inner backdrop-blur-md relative overflow-hidden text-5xl">
                🐮🧳
                <div className="absolute bottom-3 right-4 text-2xl animate-pulse">
                  🌺
                </div>
                <div className="absolute top-3 left-3 text-2xl animate-bounce font-black text-rose-500">
                  ♉
                </div>
              </div>
            </div>
            <h2 className="text-3xl font-extrabold text-white text-center mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] tracking-wide">
              生日快樂！妹妹 🎉
            </h2>
            <div className="bg-white/10 rounded-2xl p-4 px-6 border border-white/20 text-center w-full shadow-inner relative">
              <span className="absolute -top-3 left-4 text-4xl text-rose-300 opacity-50 font-serif">
                "
              </span>
              <p className="text-white/95 font-bold leading-relaxed text-[15px]">
                在最美麗的沖繩海島
                <br />
                度過最棒的一天吧！
              </p>
              <div className="mt-3 text-rose-200 text-xs italic font-serif tracking-widest">
                ~ Graceful Okinawa Trip ~
              </div>
            </div>
            <button
              onClick={() => setShowBirthday(false)}
              className="mt-6 bg-gradient-to-r from-rose-400 to-pink-500 hover:from-rose-500 hover:to-pink-600 text-white font-bold w-full py-4 rounded-2xl shadow-[0_5px_20px_rgba(225,29,72,0.4)] active:scale-95 transition-all flex justify-center items-center gap-2 text-lg tracking-wide border border-white/20"
            >
              <Sun size={20} /> 展開今天的旅程
            </button>
          </div>
        </div>
      )}

      {/* 金主抽籤動畫 Modal (3種動畫效果切換) */}
      {sponsorDrawState.isOpen && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-[0_0_80px_rgba(251,191,36,0.3)] relative overflow-hidden">
            {!sponsorDrawState.isRolling && (
              <button
                onClick={() =>
                  setSponsorDrawState({
                    isOpen: false,
                    isRolling: false,
                    name: "",
                    result: null,
                    pendingPrize: null,
                  })
                }
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-1.5 active:scale-90 z-20"
              >
                <X size={20} />
              </button>
            )}

            <div className="text-5xl mb-6">💸</div>
            <h2 className="text-xl font-extrabold text-slate-500 mb-6">
              本次買單金主是...
            </h2>

            {/* 動畫類型 1：經典老虎機 (Slot) */}
            {sponsorDrawState.drawType === "slot" && (
              <div className="bg-slate-50 border-4 border-slate-800 rounded-2xl py-8 overflow-hidden relative shadow-inner mb-6">
                {sponsorDrawState.isRolling ? (
                  <div className="text-5xl font-black text-slate-800 tracking-widest animate-slot-spin absolute inset-0 flex items-center justify-center">
                    {sponsorDrawState.name}
                  </div>
                ) : (
                  <div className="text-5xl font-black text-amber-500 tracking-widest animate-in zoom-in-50 duration-500 drop-shadow-md">
                    {sponsorDrawState.result}
                  </div>
                )}
              </div>
            )}

            {/* 動畫類型 2：生死四宮格 (Grid) */}
            {sponsorDrawState.drawType === "grid" && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {SPONSOR_CANDIDATES.map((c) => (
                  <div
                    key={c}
                    className={`py-6 rounded-2xl text-2xl font-black transition-all duration-75 flex items-center justify-center 
                      ${
                        sponsorDrawState.name === c
                          ? "bg-amber-500 text-white scale-105 shadow-[0_10px_20px_rgba(245,158,11,0.4)] z-10"
                          : "bg-slate-100 text-slate-300 scale-95"
                      }`}
                  >
                    {c}
                  </div>
                ))}
              </div>
            )}

            {/* 動畫類型 3：心跳聚光燈 (Spotlight) */}
            {sponsorDrawState.drawType === "spotlight" && (
              <div className="flex justify-center items-center h-32 bg-slate-50 rounded-[2rem] border-4 border-slate-800 shadow-inner relative overflow-hidden mb-6">
                {sponsorDrawState.isRolling ? (
                  <div className="text-5xl font-black text-slate-800 tracking-widest animate-pulse scale-125 transition-transform duration-75">
                    {sponsorDrawState.name}
                  </div>
                ) : (
                  <div className="text-5xl font-black text-amber-500 tracking-widest animate-bounce drop-shadow-md">
                    {sponsorDrawState.result}
                  </div>
                )}
              </div>
            )}

            {sponsorDrawState.result && (
              <div className="mt-8 animate-in slide-in-from-bottom-4">
                <p className="font-bold text-slate-600 text-lg mb-2">
                  恭喜{" "}
                  <span className="text-amber-500 font-black">
                    {sponsorDrawState.result}
                  </span>{" "}
                  🎉
                </p>
                <p className="text-xs text-slate-400">
                  {sponsorDrawState.pendingPrize
                    ? "已連同獎品一起存入百寶袋！"
                    : "系統已自動記錄至金主光榮榜"}
                </p>
                <button
                  onClick={() =>
                    setSponsorDrawState({
                      isOpen: false,
                      isRolling: false,
                      name: "",
                      result: null,
                      pendingPrize: null,
                    })
                  }
                  className="mt-6 w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-md active:scale-95"
                >
                  感謝乾爹 / 乾媽！
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 妹妹的百寶袋 Modal */}
      {showPrizeBag && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
          <div className="bg-[#fcfbf7] rounded-[2rem] w-full max-w-md h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8">
            <div className="bg-gradient-to-r from-rose-400 to-pink-500 p-5 pb-6 text-white relative">
              <button
                onClick={() => setShowPrizeBag(false)}
                className="absolute top-5 right-5 text-white/80 hover:text-white bg-black/10 rounded-full p-1.5 active:scale-90"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-black flex items-center gap-2">
                <Gift size={24} /> 妹妹的百寶袋
              </h2>
              <p className="text-rose-100 text-sm mt-1">
                專屬生日大獎都在這裡！找 Candy 兌換吧！
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
              {sisterPrizes.length === 0 ? (
                <div className="text-center text-slate-400 mt-10 font-bold">
                  目前空空如也，趕快去波上宮抽籤吧！
                </div>
              ) : (
                sisterPrizes.map((prize) => (
                  <div
                    key={prize.id}
                    className={`p-4 rounded-2xl border-2 transition-all ${prize.status === "redeemed" ? "bg-slate-50 border-slate-200 grayscale opacity-60" : "bg-white border-rose-200 shadow-sm"}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-extrabold text-slate-800 text-lg">
                        {prize.title}
                      </h3>
                      {prize.status === "redeemed" ? (
                        <span className="bg-slate-200 text-slate-500 text-xs font-bold px-2 py-1 rounded-md">
                          已使用
                        </span>
                      ) : (
                        <span className="bg-rose-100 text-rose-600 text-xs font-bold px-2 py-1 rounded-md animate-pulse">
                          可兌換
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-rose-500 mb-2 leading-relaxed flex items-center flex-wrap gap-2">
                      {prize.prize}
                      {/* 顯示被抽中的金主 */}
                      {prize.sponsor && (
                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-md border border-amber-200 shrink-0">
                          付款金主：{prize.sponsor}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-4">{prize.desc}</p>

                    {prize.status !== "redeemed" && (
                      <button
                        onClick={() =>
                          setRedeemState({
                            isOpen: true,
                            prizeId: prize.id,
                            code: "",
                          })
                        }
                        className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-xl shadow-md active:scale-95 text-sm"
                      >
                        👉 找 Candy 兌換
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <header className="bg-gradient-to-r from-[#93C5FD] to-[#A5F3FC] p-5 rounded-b-3xl shadow-sm sticky top-0 z-40">
        <div className="flex justify-between items-center text-slate-800">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-wider flex items-center gap-1.5">
              🌺 沖繩家族旅行
              {/* 測試按鈕：隨時解鎖 5/13 的生日與百寶袋權限 */}
              <button
                onClick={() => {
                  setIsBirthdayActive(true);
                  setShowBirthday(true);
                }}
                className="bg-white/30 hover:bg-white/50 p-1.5 rounded-full backdrop-blur-sm transition-colors active:scale-90"
                title="測試生日彩蛋"
              >
                <Gift size={14} className="text-rose-500" />
              </button>
            </h1>
          </div>

          <div className="flex gap-2">
            {/* 百寶袋入口 (僅生日當天或按下測試按鈕後顯示) */}
            {isBirthdayActive && (
              <button
                onClick={() => setShowPrizeBag(true)}
                className="bg-rose-500 text-white p-2 rounded-xl shadow-md active:scale-95 flex items-center justify-center relative"
              >
                <Gift size={20} />
                {sisterPrizes.filter((p) => p.status === "available").length >
                  0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-rose-500 animate-ping"></span>
                )}
              </button>
            )}

            <div
              onClick={() => setActiveTab("accounting")}
              className="bg-white/40 backdrop-blur-md px-3 py-2 rounded-xl flex items-center gap-2 cursor-pointer border border-white/50 shadow-sm active:scale-95"
            >
              <PiggyBank size={20} className="text-amber-500" />
              <div className="text-right">
                <p className="text-[9px] font-bold text-slate-600">總花費</p>
                <p className="font-extrabold text-sm">
                  {currency === "JPY"
                    ? `¥${totalPublicSpent.toLocaleString()}`
                    : `NT$ ${Math.round(totalPublicSpentTWD).toLocaleString()}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main
        id="main-scroll"
        className="pb-28 overflow-y-auto h-[calc(100vh-80px)] relative"
      >
        {activeTab === "itinerary" && (
          <ItineraryView
            weatherData={weatherData}
            getWeatherIcon={getWeatherIcon}
            rooms={rooms}
            setRooms={setRooms}
            usedTickets={usedTickets}
            setUsedTickets={setUsedTickets}
            startSponsorDraw={startSponsorDraw}
            isBirthdayActive={isBirthdayActive}
            sisterPrizes={sisterPrizes}
          />
        )}
        {activeTab === "accounting" && (
          <div className="p-4">
            <AccountingView
              expenses={expenses}
              currency={currency}
              setCurrency={setCurrency}
              formatTWD={formatTWD}
              showExpenseForm={showExpenseForm}
              setShowExpenseForm={setShowExpenseForm}
              expenseForm={expenseForm}
              setExpenseForm={setExpenseForm}
              handleSaveExpense={handleSaveExpense}
              handleDeleteExpense={handleDeleteExpense}
              handleToggleSplitMember={handleToggleSplitMember}
              handleEditExpense={handleEditExpense}
              handleCloseForm={handleCloseForm}
              editingId={editingId}
              sponsorDraws={sponsorDraws}
              startSponsorDraw={startSponsorDraw}
              exchangeRate={exchangeRate}
              handleOpenForm={handleOpenForm}
            />
          </div>
        )}
        {activeTab === "flights" && (
          <div className="p-4">
            <FlightsView />
          </div>
        )}
        {activeTab === "shopping" && (
          <div className="p-4">
            <ShoppingView />
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 w-full max-w-md bg-white/95 backdrop-blur-lg border-t border-slate-200 flex justify-around p-3 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-3xl z-40">
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
          icon={<ShoppingBag />}
          label="購物優惠"
          isActive={activeTab === "shopping"}
          onClick={() => setActiveTab("shopping")}
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

function NavItem({ icon, label, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center transition-all duration-300 ${isActive ? "text-sky-600 scale-110" : "text-slate-400 hover:text-sky-500"}`}
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

// --- 行程畫面模組 ---
function ItineraryView({
  weatherData,
  getWeatherIcon,
  rooms,
  setRooms,
  usedTickets,
  onToggleUsedTicket,
  startSponsorDraw,
  startLuckyDraw,
  canUseBirthdaySurprise,
  isBirthdayActive,
  sisterPrizes,
}) {
  const [selectedOptions, setSelectedOptions] = useState(null);
  const [activeDay, setActiveDay] = useState(0);
  const [isEditingRooms, setIsEditingRooms] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);

  const [omikujiState, setOmikujiState] = useState({
    isOpen: false,
    step: null,
    result: null,
  });

  const OMIKUJI_POOL = {
    大吉: {
      title: "🌸 大吉 🌸",
      color: "text-rose-500",
      bg: "from-rose-50 to-rose-100 border-rose-300",
      desc: "「恭喜成為本次沖繩財運之神！」",
      prizes: [
        "🎉 下一餐免單券 (請大聲呼叫本團金主買單)",
        "🍣 壽司自由點一盤 (可指定一盤高級壽司，大家不能阻止你)",
        "🧋 全家飲料王 (全員飲料由一位幸運金主贊助)",
        "🎁 神秘扭蛋權 (可指定任何一位家人幫你買一個扭蛋)",
        "💴 ¥1600 旅遊基金 (一人400元，旅途中可直接使用)",
        "👑 壽星神權 (今天任何人不能拒絕你的一次要求)",
      ],
    },
    中吉: {
      title: "✨ 中吉 ✨",
      color: "text-orange-500",
      bg: "from-orange-50 to-orange-100 border-orange-300",
      desc: "運氣很不錯喔！開心出遊最重要！",
      prizes: [
        "🍗 獲得 LAWSON 炸雞券一份",
        "📸 指定拍照權 (可以指定全家配合拍一張奇怪姿勢照片)",
        "🛍️ 便利商店零食券 ¥300",
        "☕ 免費飲料券 (飲料免費一杯)",
        "🧸 沖繩小物 ¥300 (今天看到喜歡的都買，不准阻止)",
      ],
    },
    小吉: {
      title: "🍀 小吉 🍀",
      color: "text-teal-500",
      bg: "from-teal-50 to-teal-100 border-teal-300",
      desc: "充滿小確幸的一天！",
      prizes: [
        "🍫 小零食基金 ¥100",
        "📷 擔任今日幸運攝影師 (負責幫大家拍好看的照片)",
        "🫶 獲得全家稱讚一次 (大家必須誇你一句)",
        "✨ 今日運氣加成 (下次抽籤可重抽一次)",
      ],
    },
    隱藏彩蛋: {
      title: "🤣 隱藏彩蛋 🤣",
      color: "text-purple-600",
      bg: "from-purple-50 to-purple-100 border-purple-300",
      desc: "這才是旅程最棒的回憶 (大凶1%)",
      prizes: [
        "💀 今天負責導航 (但其實導航超容易迷路)",
        "🦁 沖繩獅子守護者 (必須跟一隻風獅爺合照)",
        "👯 全家指定 pose 拍照 (抽到的人要負責設計 pose)",
      ],
    },
  };

  const drawOmikuji = () => {
    setOmikujiState({ isOpen: true, step: "shaking", result: null });

    let roll = Math.random() * 100;
    let rank = roll < 50 ? "大吉" : roll < 85 ? "中吉" : "小吉";

    let availablePrizes = [...OMIKUJI_POOL[rank].prizes];
    if (rank === "大吉") {
      const has1600Won = sisterPrizes.some(
        (p) => p.prize && p.prize.includes("¥1600 旅遊基金"),
      );
      if (has1600Won) {
        availablePrizes = availablePrizes.filter(
          (p) => !p.includes("¥1600 旅遊基金"),
        );
      }
    }

    const prize =
      availablePrizes[Math.floor(Math.random() * availablePrizes.length)];
    const resultObj = { ...OMIKUJI_POOL[rank], prize };

    setTimeout(() => {
      setOmikujiState((prev) => ({ ...prev, step: "falling" }));
      setTimeout(() => {
        setOmikujiState((prev) => ({
          ...prev,
          step: "result",
          result: resultObj,
        }));
      }, 1200);
    }, 1500);
  };

  const handleAcceptPrize = async () => {
    try {
      const firestore = getDbOrThrow();
      await addDoc(collection(firestore, "sister_prizes"), {
        title: omikujiState.result.title,
        desc: omikujiState.result.desc,
        prize: omikujiState.result.prize,
        status: "available",
        createdAt: Date.now(),
      });
      setOmikujiState({ isOpen: false, step: null, result: null });
    } catch (err) {
      alert("儲存失敗：" + err.message);
    }
  };

  const handleSaveRooms = async () => {
    setIsEditingRooms(false);
    try {
      const firestore = getDbOrThrow();
      await setDoc(doc(firestore, "shared_data", "rooms"), rooms);
    } catch (error) {
      alert("儲存房號失敗，請檢查網路連線。");
    }
  };

  // 🚀 核心日期檢查邏輯：5月11日才解鎖門票，或啟用測試模式時解鎖
  const today = new Date();
  const isTicketUnlockDay =
    (today.getMonth() === 4 && today.getDate() === 11) || isBirthdayActive;

  const tripDates = [
    {
      id: 0,
      title: "DAY 1",
      date: "1/21",
      realDate: "5/10",
      fullDate: "2026-05-10",
    },
    {
      id: 1,
      title: "DAY 2",
      date: "1/22",
      realDate: "5/11",
      fullDate: "2026-05-11",
    },
    {
      id: 2,
      title: "DAY 3",
      date: "1/23",
      realDate: "5/12",
      fullDate: "2026-05-12",
    },
    {
      id: 3,
      title: "DAY 4",
      date: "1/24",
      realDate: "5/13",
      fullDate: "2026-05-13",
    },
    {
      id: 4,
      title: "DAY 5",
      date: "1/25",
      realDate: "5/14",
      fullDate: "2026-05-14",
    },
    {
      id: 5,
      title: "DAY 6",
      date: "1/26",
      realDate: "5/15",
      fullDate: "2026-05-15",
    },
  ];

  const scrollToDay = (index) => {
    setActiveDay(index);
    const element = document.getElementById(`day-${index}`);
    const mainScroll = document.getElementById("main-scroll");
    if (element && mainScroll) {
      const topOffset = element.offsetTop - 100;
      mainScroll.scrollTo({ top: topOffset, behavior: "smooth" });
    }
  };

  const itineraryData = [
    {
      title: "抵達與北谷美國村",
      items: [
        {
          type: "flight",
          time: "12:20",
          title: "抵達 OKA",
          desc: "前往租車接送點",
        },
        {
          type: "spot",
          time: "13:00",
          title: "取車 (三菱 Delica)",
          desc: "自駕，尋找大型停車場",
        },
        {
          type: "spot",
          time: "15:00",
          title: "蒙帕公寓式飯店 Check-in",
          desc: "約40分車程，美國村旁",
        },
        {
          type: "food",
          time: "午餐",
          title: "午餐 (3家備案選1)",
          desc: "點擊查看選項",
          options: [
            {
              name: "泊港漁市場",
              desc: "推薦現切鮪魚。大國海產、中真水產有代客料理+內用座位。",
              map: "https://maps.google.com/?q=泊港漁市場",
              img: "/food/fishMarket.jpg",
            },
            {
              name: "A&W Makiminato",
              desc: "停好車在車上點餐！推薦：The A&W Burger、麥根沙士、捲薯條。",
              map: "https://maps.google.com/?q=A&W+Makiminato",
              img: "/food/A&W.jpg",
            },
            {
              name: "Tonkatsu Taro Chatan Branch",
              desc: "25公分巨大炸蝦！",
              map: "https://maps.google.com/?q=Tonkatsu+Taro+Chatan",
              img: "/food/shrimp.jpg",
            },
          ],
        },
        {
          type: "spot",
          time: "下午",
          title: "美國村 (American Village)",
          desc: "點擊查看必吃必逛清單",
          options: [
            {
              name: "Cheesus cafe",
              desc: "必吃熱騰騰烤起司三明治！",
              map: "https://maps.google.com/?q=Cheesus+cafe+北谷",
              img: "/food/cheeseUs.jpg",
            },
            {
              name: "焼き芋 自動販売機",
              desc: "超特別！路邊熱騰騰烤地瓜自動販賣機",
              map: "https://maps.google.com/?q=北谷+烤地瓜販賣機",
              img: "/food/atm.png",
            },
            {
              name: "GIGO 北谷",
              desc: "夾娃娃機、扭蛋天堂",
              map: "https://maps.google.com/?q=GIGO+北谷",
              img: "/source/gigo.jpg",
            },
            {
              name: "Blue Seal (北谷店)",
              desc: "營業 11:00–21:00。推薦沖繩鹽餅乾 / 紅芋冰，海景第一排吃冰淇淋！",
              map: "https://maps.google.com/?q=Blue+Seal+北谷",
            },
          ],
        },
        {
          type: "food",
          time: "晚餐",
          title: "晚餐選項",
          desc: "點擊查看選項",
          options: [
            {
              name: "迴轉壽司市場 美浜店",
              desc: "人氣平價迴轉壽司",
              map: "https://maps.google.com/?q=迴轉壽司市場+美浜店",
              img: "/food/cycleSushi.jpg",
            },
            {
              name: "歩炉 北谷店",
              desc: "營業 16:00–23:00。推薦：串燒、肥鮪魚捲、10塊烤肉拼盤",
              map: "https://maps.google.com/?q=歩炉+北谷店",
              img: "/food/yakitori.png",
            },
          ],
        },
      ],
    },
    {
      title: "古宇利島 + 水族館",
      items: [
        {
          type: "spot",
          time: "08:30",
          title: "出發前往北部",
          desc: "早點出發避車潮",
        },
        {
          type: "food",
          time: "上午",
          title: "⭐ 許田休息站",
          desc: "點擊查看必吃美食",
          options: [
            {
              name: "許田休息站",
              desc: "日本第一名道の駅！營業時間：08:30–19:00",
              map: "https://maps.google.com/?q=許田休息站",
            },
            {
              name: "琉球銘菓 三矢",
              desc: "必吃：三矢本舖的沖繩傳統炸甜甜圈「沙翁」",
              map: "https://maps.google.com/?q=琉球銘菓+三矢",
            },
          ],
        },
        {
          type: "spot",
          time: "10:00",
          title: "古宇利島",
          desc: "點擊查看景點與美食",
          options: [
            {
              name: "古宇利大橋",
              desc: "必拍絕美海景。",
              map: "https://maps.app.goo.gl/y9uHJg2Kos4TC52P8",
              img: "/kouriBridge.jpg",
            },
            {
              name: "心型岩",
              desc: "必拍心型礁岩。",
              map: "https://maps.google.com/?q=古宇利島心型岩",
              img: "/heartRock.jpg",
            },
            {
              name: "KOURI SHRIMP (蝦蝦飯)",
              desc: "營業時間 11:00 - 16:00。古宇利島必吃夏威夷蒜香蝦蝦飯！",
              map: "https://maps.google.com/?q=KOURI+SHRIMP",
              img: "/food/kouri-shrimp.jpg",
            },
            {
              name: "Shinmei Coffee",
              desc: "營業時間 10:30 - 16:30。大推現刨生黑糖拿鐵，生黑糖珍珠鮮奶茶！",
              map: "https://maps.google.com/?q=Shinmei+Coffee",
              note: "⚠️ 僅收現金或電子支付，不可刷信用卡",
            },
          ],
        },
        {
          type: "info",
          time: "13:00",
          title: "美麗海水族館",
          desc: "園區詳細資訊與電子門票",
          options: [
            {
              name: "🚗 停車場資訊",
              desc: "園內 9 個停車場皆免費！\n優先尋找「大型停車場」停放。",
              img: "/source/aquarium.png",
            },
            {
              name: "🎫 入場電子門票 - 爸爸",
              desc: "請準備好手機刷 QR Code 入場。",
              isTicket: true,
              id: "ticket-papa",
              img: "/tickets/ticket1.jpg",
            },
            {
              name: "🎫 入場電子門票 - 媽媽",
              desc: "請準備好手機刷 QR Code 入場。",
              isTicket: true,
              id: "ticket-mama",
              img: "/tickets/ticket2.jpg",
            },
            {
              name: "🎫 入場電子門票 - 妹妹",
              desc: "請準備好手機刷 QR Code 入場。",
              isTicket: true,
              id: "ticket-sister",
              img: "/tickets/ticket3.jpg",
            },
            {
              name: "🎫 入場電子門票 - 書瑋",
              desc: "請準備好手機刷 QR Code 入場。",
              isTicket: true,
              id: "ticket-shuwei",
              img: "/tickets/ticket4.jpg",
            },
            {
              name: "🎫 入場電子門票 - Candy",
              desc: "請準備好手機刷 QR Code 入場。",
              isTicket: true,
              id: "ticket-candy",
              img: "/tickets/ticket5.jpg",
            },
            {
              name: "🐬 海豚秀時間表 (戶外展區)",
              desc: "表演時間：\n10:30 / 11:30 / 13:00 / 14:30 / 16:00 / 17:00",
              note: "建議提前 15 分鐘去卡位！",
            },
            {
              name: "🐟 海豚餵食體驗 (海豚館)",
              desc: "體驗費用：500日圓 / 1份\n付款方式：僅接受信用卡\n\n【每日場次】\n① 10:00～10:30\n② 11:00～11:30\n③ 12:00～12:30\n④ 13:30～14:00\n⑤ 15:30～16:00",
              note: "※ 每人最多限購 5 份",
            },
            {
              name: "🐋 黑潮之海 鯨鯊餵食秀",
              desc: "表演時間：\n15:00 / 17:00",
              note: "在室內的主水槽區",
            },
          ],
        },
        {
          type: "spot",
          time: "傍晚",
          title: "回程停留",
          desc: "點擊查看回程推薦",
          options: [
            {
              name: "星巴克 名護21世紀之森公園店",
              desc: "特色水果星冰樂！風景優美的休息站。",
              map: "https://maps.google.com/?q=星巴克+名護21世紀之森公園",
            },
            {
              name: "海人料理 亀ぬ浜",
              desc: "營業時間 17:00 - 21:00。晚餐好去處。",
              map: "https://maps.google.com/?q=海人料理+亀ぬ浜",
            },
          ],
        },
      ],
    },
    {
      title: "北谷 → 那霸 (中部往南)",
      items: [
        {
          type: "spot",
          time: "10:00",
          title: "退房與移動",
          desc: "前往那霸市區",
        },
        {
          type: "food",
          time: "午餐",
          title: "途中美食大搜查",
          desc: "點擊查看美食清單",
          options: [
            {
              name: "港川外人住宅雞湯拉麵屋 いしぐふ",
              desc: "初代沖繩麵王！招牌 Tokusen soba（綜合雞肉拉麵）, 椒鹽雞肉/滷汁雞肉。\n套餐是多一小碗的飯（溫泉蛋拌飯、雞湯汁拌飯、烤雞肉拌飯三選一）",
              map: "https://maps.google.com/?q=いしぐふ+港川",
              img: "/food/TokusenSoba.jpg",
            },
            {
              name: ".uki",
              desc: "營業時間 7:00 - 17:00，杯測冠軍！",
              map: "https://maps.google.com/?q=.uki+okinawa",
            },
            {
              name: "A&W Makiminato",
              desc: "路上經過，特色是停好車可以在車上點餐，店員會送來。",
              map: "https://maps.google.com/?q=A&W+Makiminato",
            },
            {
              name: "COCOROAR CAFE",
              desc: "招牌甜點是使用「下川六〇酵素卵」與米粉製作的鬆餅。",
              map: "https://maps.google.com/?q=COCOROAR+CAFE",
            },
            {
              name: "Okinawa Cerrado Coffee",
              desc: "超讚手沖咖啡",
              map: "https://maps.google.com/?q=Okinawa+Cerrado+Coffee",
            },
            {
              name: "oHacorte 港川店",
              desc: "超美特色水果塔，起司塔/草莓塔。",
              map: "https://maps.google.com/?q=oHacorte+港川店",
              img: "/food/cheeseTart.jpg",
            },
            {
              name: "Houki Boshi",
              desc: "必買黑糖可麗露，黑糖星星餅乾。",
              map: "https://maps.google.com/?q=Houki+Boshi",
              img: "/food/brownSugarCookie.jpg",
            },
          ],
        },
        {
          type: "spot",
          time: "15:00",
          title: "Hotel Urbansea 2 Check-in",
          desc: "國際通附近",
        },
        {
          type: "shopping",
          time: "下午",
          title: "國際通採買",
          desc: "點擊查看必買伴手禮與點心",
          options: [
            {
              name: "松原屋製菓",
              desc: "必買：沙翁 (沖繩傳統炸甜甜圈)，營業時間 09:00–18:00。",
              map: "https://maps.google.com/?q=松原屋製菓",
              img: "/food/donut.jpg",
            },
            {
              name: "福助玉子燒",
              desc: "必吃：玉子燒飯糰。",
              map: "https://maps.google.com/?q=福助玉子燒+那霸",
            },
            {
              name: "Mochi-no-mise Yamaya",
              desc: "沖繩傳統麻糬專賣店，沖繩麻糬/沖繩草仔粿。",
              map: "https://maps.google.com/?q=Mochi-no-mise+Yamaya",
              img: "/food/okinawamochi.jpg",
            },
            {
              name: "琉球牛乳餅",
              desc: "鮮奶麻糬（類似炸牛奶/蕨餅口感），特色口味包括原味、紫薯、紅糖。",
              map: "https://maps.google.com/?q=琉球牛乳餅",
              img: "/food/milk_ricecake.jpg",
            },
            {
              name: "Hama Shokhuin",
              desc: "推薦：花生豆腐。",
              map: "https://maps.google.com/?q=Hama+Shokhuin",
            },
            {
              name: "Maxi Pudding",
              desc: "推薦：茉莉花茶、沖繩咖啡、蔗糖口味的生布丁。\n以急速冷凍封存代替烘焙，做出如同奶昔般的口感。",
              map: "https://maps.google.com/?q=Maxi+Pudding+那霸",
            },
            {
              name: "Jisakasu",
              desc: "充滿特色的在地二手小店。",
              map: "https://maps.google.com/?q=Jisakasu+okinawa",
            },
            {
              name: "BURGER TIME",
              desc: "BLT酪梨起司漢堡 推薦！",
              map: "https://maps.google.com/?q=BURGER+TIME+那霸",
            },
            {
              name: "Calbee+",
              desc: "現炸薯條跟馬鈴薯吉拿棒",
              map: "https://maps.google.com/?q=Calbee+那霸",
            },
            {
              name: "風獅爺燒",
              desc: "沖繩在地特色風獅爺雞蛋糕",
              map: "https://maps.google.com/?q=風獅爺燒",
            },
          ],
        },
        {
          type: "food",
          time: "晚餐",
          title: "晚餐選項 (擇一)",
          desc: "點擊查看",
          options: [
            {
              name: "國際通屋台村",
              desc: "從飯店走路只要 8 分鐘",
              map: "https://maps.google.com/?q=國際通屋台村",
            },
            {
              name: "Okiraku",
              desc: "好吃的關東煮，類似居酒屋",
              map: "https://maps.google.com/?q=Okiraku+okinawa",
            },
            {
              name: "鳥貴族",
              desc: "營業時間 17:00–01:00。備案：高CP值串燒",
              map: "https://maps.google.com/?q=鳥貴族+那霸",
            },
          ],
        },
      ],
    },
    {
      title: "神社與市區採買",
      items: [
        {
          type: "food",
          time: "早餐",
          title: "早餐 2 選 1",
          desc: "點擊查看",
          options: [
            {
              name: "Marutama味噌飯屋",
              desc: "營業時間 07:30–10:00。160多年老店，推薦肉味增納豆/味增湯定食。",
              map: "https://maps.google.com/?q=Marutama味噌飯屋",
            },
            {
              name: "おにぎり屋 縁むすび",
              desc: "營業時間 08:00–09:30。日式飯糰",
              map: "https://maps.google.com/?q=おにぎり屋+縁むすび",
            },
          ],
        },
        {
          type: "spot",
          time: "上午",
          title: "波上宮",
          desc: "點擊查看參拜步驟與注意事項",
          options: [
            {
              name: "波上宮參拜須知",
              desc: "還御守。御守授與時間為 9:00～17:00\n\n【淨化儀式：手水舍】\n參拜前，請先在入口處的「手水舍」進行淨手淨口：\n1. 用勺子舀水清洗左手、右手。\n2. 用左手漱口。\n3. 將勺子直立，讓剩餘的水流下清洗勺柄。\n\n【參拜流程】\n1. 投幣（5円）\n2. 搖鈴\n3. 二拜二拍（深深鞠躬兩次，拍手兩下，以示尊敬。）\n4. 合掌祈禱\n5. 一拜",
              map: "https://maps.google.com/?q=波上宮",
              isOmikuji: true,
            },
          ],
        },
        {
          type: "food",
          time: "咖啡",
          title: "參拜後咖啡休息",
          desc: "點擊查看",
          options: [
            {
              name: "TURNER COFFEE",
              desc: "營業時間 10:30–17:00。推薦：Oat Milk Latte (燕麥奶拿鐵)",
              map: "https://maps.google.com/?q=TURNER+COFFEE",
            },
            {
              name: "Aguro Baisen Coffee",
              desc: "營業時間 09:00–18:00。推薦：培根蛋吐司和冰咖啡套餐。",
              map: "https://maps.google.com/?q=Aguro+Baisen+Coffee",
              note: "⚠️ 此店家僅接受現金付款",
            },
          ],
        },
        {
          type: "spot",
          time: "下午",
          title: "波之上海空公園 & 購物",
          desc: "波之上海空公園、無印良品 那霸Main Place店、壺屋通\n第一牧志公設市場 (8:00~22:00) 大城屋",
          options: [
            {
              name: "波之上海空公園",
              desc: "在海邊放鬆散步，欣賞美麗海景。",
              map: "https://maps.google.com/?q=波之上海空公園",
            },
            {
              name: "無印良品 (那霸 Main Place店)",
              desc: "大型購物商場內，好買好逛。",
              map: "https://maps.google.com/?q=無印良品+那霸Main+Place",
            },
            {
              name: "壺屋通",
              desc: "沖繩傳統陶器街，很適合文青散步買紀念品。",
              map: "https://maps.google.com/?q=壺屋通",
            },
            {
              name: "第一牧志公設市場",
              desc: "營業時間 8:00-22:00。沖繩的廚房，推薦尋找隱藏美味「大城屋」。",
              map: "https://maps.google.com/?q=第一牧志公設市場",
            },
          ],
        },
        {
          type: "food",
          time: "17:00",
          title: "晚餐：琉球之牛",
          desc: "點擊查看訂位資訊與備註",
          options: [
            {
              name: "琉球之牛 & 唐吉訶德",
              desc: "牛舌推薦，可以直接點套餐。\n吃完後逛唐吉訶德 那霸壺川店 (人少走道寬好逛)\n\n🛒 伴手禮推薦：請至「購物優惠」頁面查看願望清單！",
              map: "https://maps.google.com/?q=琉球之牛+那霸",
              note: "🚨 預約確認號碼：5C2H4G！遲到15分鐘會直接取消！",
            },
          ],
        },
      ],
    },
    {
      title: "美食與購物日",
      items: [
        {
          type: "food",
          time: "07:00",
          title: "早餐 2 選 1",
          desc: "點擊查看地圖",
          options: [
            {
              name: "Furinkazan 風林火山",
              desc: "營業時間 07:00–11:00 (周三公休)。日式特色早餐。",
              map: "https://maps.google.com/?q=風林火山+那霸",
              img: "/food/furinkazhan.jpg",
            },
            {
              name: "Haruchii",
              desc: "特色肉卷飯糰",
              map: "https://maps.google.com/?q=Haruchii+那霸",
              img: "/food/haruchii.jpg",
            },
          ],
        },
        {
          type: "spot",
          time: "上午",
          title: "首里城 行程",
          desc: "點擊查看參觀路線",
          options: [
            {
              name: "首里城公園",
              desc: "門票：成人 400 日幣，6歲以下免費。\n\n【參觀重點路線】\n• 守禮門\n• 園比屋武御嶽石門 (國王祈願祭拜所)\n• 歡會門 (歡迎受邀前來的中國皇帝使節)\n• 瑞泉門\n• 首里杜館\n• 奉神門\n• 首里城正殿 (國家歷史遺址)\n• 東之物見台 (眺望風景的瞭望台)",
              map: "https://maps.google.com/?q=首里城",
            },
          ],
        },
        {
          type: "food",
          time: "午餐",
          title: "漁師食堂 (大ばんぶる舞)",
          desc: "點擊查看完整菜單",
          options: [
            {
              name: "🐟 生食推薦菜單",
              desc: "• 肥美赤甜蝦刺身(2尾) ¥380\n• 生食級生蠔佐醋醬(1個) ¥280\n• 增量漁師丼 OR 增量蔥鮪丼 (霸氣) ¥1,290\n• 定番海鮮丼(附醋飯)定食 只要 ¥1,080",
              map: "https://maps.google.com/?q=大ばんぶる舞",
            },
            {
              name: "🍤 熟食推薦菜單",
              desc: "• 大ばんぶる舞鰻魚丼 約¥2,380\n• 炸蝦丼 (えびだけ丼)\n• 厚切炸竹筴魚定食 (アジフライ定食)\n• 煎魚定食 (魚の煮付け / 焼き魚)\n• 魚湯定食 (船上の魚汁) 👉 熱湯，OK\n• 鮪魚排咖哩 (鮪カツカレー) 👉 熟炸",
              map: "https://maps.google.com/?q=大ばんぶる舞",
              img: "/food/巨大鰻魚飯.jpg",
            },
          ],
        },
        {
          type: "shopping",
          time: "下午",
          title: "市區逛街 & 瀨長島",
          desc: "點擊查看行程選項",
          options: [
            {
              name: "hoppepan",
              desc: "營業 10:00–19:00 (二,三休息)。必買：明太子法國麵包、炸蝦堡！",
              map: "https://maps.google.com/?q=hoppepan",
            },
            {
              name: "UNIQLO",
              desc: "天久店 或 那霸店",
              map: "https://maps.google.com/?q=UNIQLO+Ryubo+Ameku+Rakuichi",
            },
            {
              name: "無印良品 (天久店)",
              desc: "天久購物區的無印良品",
              map: "https://maps.google.com/?q=無印良品+天久",
            },
            {
              name: "無印良品 (Palette久茂地店)",
              desc: "位於久茂地的無印良品分店",
              map: "https://maps.google.com/?q=無印良品+Palette久茂地店",
            },
            {
              name: "瀨長島 (沖繩小希臘)",
              desc: "瀨長島海風露台、子寶岩、瀨長島日落公園、瀨長海灘",
              map: "https://maps.google.com/?q=瀨長島",
            },
          ],
        },
        {
          type: "food",
          time: "晚餐",
          title: "晚餐選項",
          desc: "點擊查看",
          options: [
            {
              name: "傑克牛排館 (Jack's Steak House)",
              desc: "營業時間 11:00 - 22:30 (星期三休息)。沖繩經典老字號美式牛排館。",
              map: "https://maps.google.com/?q=傑克牛排館",
              img: "/food/jack-steak.jpg",
            },
            {
              name: "賴長島 (海風露台)",
              desc: "在瀨長島找間喜歡的異國料理看夜景吃晚餐",
              map: "https://maps.google.com/?q=瀨長島海風露台",
            },
            {
              name: "第一牧志公設市場",
              desc: "營業時間 8:00~22:00。\n\n(註：步沙翁營業時間為 11:00–17:00，周三周日公休)",
              map: "https://maps.google.com/?q=第一牧志公設市場",
            },
          ],
        },
      ],
    },
    {
      title: "賦歸",
      items: [
        {
          type: "food",
          time: "09:00",
          title: "BOULANGERIE BZ",
          desc: "點擊查看地圖",
          options: [
            {
              name: "BOULANGERIE BZ",
              desc: "營業時間 09:00–19:00。大推迷你可頌麵包，必買外帶回台！",
              map: "https://maps.google.com/?q=BOULANGERIE+BZ",
              img: "/food/crossant.jpg",
            },
          ],
        },
        {
          type: "food",
          time: "午餐",
          title: "琉球新麵 通堂 小祿本店",
          desc: "點擊查看推薦麵款",
          options: [
            {
              name: "琉球新麵 通堂 (小祿本店)",
              desc: "營業時間 11:00–23:30\n\n🍜 男人麵：豚骨湯，味道濃郁偏重口味，圓細麵。\n🍜 女人麵：雞高湯，味道清爽偏輕淡口味，扁細麵。",
              map: "https://maps.google.com/?q=琉球新麵+通堂+小祿本店",
            },
          ],
        },
        {
          type: "spot",
          time: "13:30",
          title: "抵達租車公司還車",
          desc: "滿油還車、保留加油收據！最晚 15:30 前要還車。\n建議 13:30 到租車公司，最晚 13:50 到並等接駁去機場。\n最好是 14:00 前到機場！",
        },
        {
          type: "flight",
          time: "16:50",
          title: "那霸起飛 (OKA)",
          desc: "17:30 抵達桃園 (TPE)",
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
      case "info":
        return <Info className="text-indigo-400" size={18} />;
      default:
        return <Map className="text-slate-400" size={18} />;
    }
  };

  const getModalIcon = (type, size = 20) => {
    if (type === "food")
      return <Utensils size={size} className="text-orange-400" />;
    if (type === "shopping")
      return <ShoppingBag size={size} className="text-rose-500" />;
    if (type === "info")
      return <Info size={size} className="text-indigo-400" />;
    return <MapPin size={size} className="text-teal-500" />;
  };

  return (
    <div className="bg-[#f3f8f9]">
      <div className="sticky top-0 z-30 bg-[#f3f8f9] pt-4 pb-2 border-b border-sky-100 shadow-sm">
        <div className="flex overflow-x-auto gap-3 px-4 snap-x hide-scrollbar">
          {tripDates.map((d, i) => {
            const weather = weatherData[d.fullDate];
            const isActive = activeDay === i;
            return (
              <div
                key={i}
                onClick={() => scrollToDay(i)}
                className={`min-w-[85px] snap-start cursor-pointer rounded-[20px] py-3 px-2 flex flex-col items-center transition-all border-2 ${isActive ? "border-sky-500 bg-white shadow-sm" : "border-transparent bg-white shadow-sm opacity-70"}`}
              >
                <span
                  className={`text-[10px] font-extrabold ${isActive ? "text-slate-500" : "text-slate-400"}`}
                >
                  {d.title}
                </span>
                <span
                  className={`text-xl font-extrabold mt-1 leading-none ${isActive ? "text-sky-700" : "text-sky-600"}`}
                >
                  {d.realDate}
                </span>
                <div className="flex items-center justify-center gap-1 mt-2 text-slate-500 text-xs font-medium">
                  {getWeatherIcon(weather?.code)}{" "}
                  {weather ? `${weather.max}°` : "-°"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg">
              <Building size={20} className="text-slate-700" /> 住宿房號紀錄
            </h3>
            <button
              onClick={() => {
                if (isEditingRooms) {
                  handleSaveRooms();
                } else {
                  setIsEditingRooms(true);
                }
              }}
              className="bg-sky-50 hover:bg-sky-100 text-sky-600 px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1 active:scale-95 transition-transform"
            >
              <Edit2 size={14} /> {isEditingRooms ? "完成" : "編輯"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-3.5 bg-[#f8fafc]">
              <p className="text-[11px] font-extrabold text-slate-400 mb-1.5">
                ROOM 1 (北谷)
              </p>
              <div className="flex items-center gap-2">
                <Key size={16} className="text-slate-300" />
                {isEditingRooms ? (
                  <input
                    type="text"
                    placeholder="輸入房號"
                    value={rooms.montpa}
                    onChange={(e) =>
                      setRooms({ ...rooms, montpa: e.target.value })
                    }
                    className="w-full bg-white border border-slate-200 p-1.5 rounded-lg font-bold text-sky-700 outline-none text-center shadow-sm focus:ring-2 focus:ring-sky-200"
                  />
                ) : (
                  <span className="font-extrabold text-slate-700 text-lg tracking-wider">
                    {rooms.montpa || "---"}
                  </span>
                )}
              </div>
            </div>
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-3.5 bg-[#f8fafc]">
              <p className="text-[11px] font-extrabold text-slate-400 mb-1.5">
                ROOM 2 (那霸)
              </p>
              <div className="flex items-center gap-2">
                <Key size={16} className="text-slate-300" />
                {isEditingRooms ? (
                  <input
                    type="text"
                    placeholder="輸入房號"
                    value={rooms.urbansea}
                    onChange={(e) =>
                      setRooms({ ...rooms, urbansea: e.target.value })
                    }
                    className="w-full bg-white border border-slate-200 p-1.5 rounded-lg font-bold text-sky-700 outline-none text-center shadow-sm focus:ring-2 focus:ring-sky-200"
                  />
                ) : (
                  <span className="font-extrabold text-slate-700 text-lg tracking-wider">
                    {rooms.urbansea || "---"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-10">
          {itineraryData.map((day, index) => {
            const dateInfo = tripDates[index];
            return (
              <div key={index} id={`day-${index}`} className="relative pt-2">
                <div className="flex items-end gap-2 mb-4 ml-2">
                  <span className="bg-sky-500 text-white text-xs font-extrabold px-3 py-1 rounded-full">
                    {dateInfo.title}
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-800">
                    {dateInfo.realDate} {day.title}
                  </h2>
                </div>

                <div className="relative border-l-2 border-sky-200 ml-5 pl-6 space-y-5">
                  {day.items.map((item, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[31px] top-1 w-3 h-3 bg-white border-2 border-sky-300 rounded-full"></div>

                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-3">
                        <div className="flex gap-3 w-full">
                          <div className="mt-0.5 p-2 bg-slate-50 rounded-xl shrink-0 h-fit">
                            {getIcon(item.type)}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-slate-800 text-[15px] flex items-center gap-2">
                              {item.time && (
                                <span className="text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md text-xs">
                                  {item.time}
                                </span>
                              )}
                              {item.title}
                            </p>
                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed whitespace-pre-line">
                              {item.desc}
                            </p>

                            {item.options && (
                              <button
                                onClick={() =>
                                  setSelectedOptions({
                                    title: item.title,
                                    options: item.options,
                                    type: item.type,
                                  })
                                }
                                className="w-full mt-3 bg-sky-50 hover:bg-sky-100 text-sky-600 font-bold py-2.5 rounded-xl text-sm transition-colors border border-sky-100 flex items-center justify-center gap-2 active:scale-95"
                              >
                                {getModalIcon(item.type, 14)} 點擊查看{" "}
                                {item.options.length} 項內容
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 彈窗卡片 */}
      {selectedOptions && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full max-w-md h-[85vh] sm:h-[80vh] rounded-t-[32px] sm:rounded-3xl p-5 flex flex-col shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center pb-3 mb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                {getModalIcon(selectedOptions.type, 20)} {selectedOptions.title}
              </h3>
              <button
                onClick={() => setSelectedOptions(null)}
                className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full shadow-sm active:scale-95"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pb-8 pr-1 hide-scrollbar mt-2">
              {selectedOptions.options.map((opt, i) => {
                const isUsed = opt.isTicket && usedTickets[opt.id];

                return (
                  <div
                    key={i}
                    className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200 flex flex-col"
                  >
                    {opt.img && (
                      <div
                        className={`h-40 bg-slate-100 flex items-center justify-center relative overflow-hidden group shrink-0 ${!isTicketUnlockDay && opt.isTicket ? "cursor-not-allowed opacity-50 grayscale" : "cursor-zoom-in"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isTicketUnlockDay && opt.isTicket) {
                            alert(
                              "🎟️ 電子門票只限 5/11 當日開放驗票喔！\n(提示：點擊首頁上方的 🎁 測試按鈕可強制解鎖)",
                            );
                            return;
                          }
                          setZoomedImage(opt.img);
                        }}
                      >
                        <img
                          src={opt.img}
                          alt={opt.name}
                          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${isUsed ? "grayscale opacity-30" : ""}`}
                        />
                        {isUsed && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <span className="bg-slate-800/80 text-white font-black tracking-widest text-3xl px-6 py-2 border-4 border-white/80 transform -rotate-12 rounded-lg backdrop-blur-sm shadow-xl">
                              USED
                            </span>
                          </div>
                        )}
                        {/* ⏳ 未開放時顯示鎖定圖示 */}
                        {!isTicketUnlockDay && opt.isTicket && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <span className="bg-slate-800/70 text-white font-black px-4 py-2 rounded-lg backdrop-blur-sm shadow-xl flex items-center gap-2">
                              <Info size={18} /> 5/11 開放
                            </span>
                          </div>
                        )}
                        <div className="absolute top-3 left-3 bg-white/90 px-3 py-1 rounded-lg text-xs font-extrabold text-slate-700 shadow-sm pointer-events-none">
                          NO.{i + 1}
                        </div>
                      </div>
                    )}

                    <div className="p-5 flex flex-col flex-1">
                      <h4 className="font-extrabold text-sky-800 text-base mb-2 flex items-center gap-2">
                        {!opt.img && (
                          <span className="bg-sky-50 text-sky-600 px-2 py-0.5 rounded text-xs border border-sky-100 shadow-sm">
                            NO.{i + 1}
                          </span>
                        )}
                        {opt.name}
                      </h4>

                      {opt.note && (
                        <div className="mb-3 bg-rose-50 text-rose-600 text-xs font-bold px-3 py-2.5 rounded-lg border border-rose-100 flex items-start gap-1.5 leading-relaxed">
                          <AlertCircle size={14} className="shrink-0 mt-0.5" />{" "}
                          <span className="whitespace-pre-line">
                            {opt.note}
                          </span>
                        </div>
                      )}

                      {opt.desc && (
                        <p className="text-sm text-slate-500 mb-4 leading-relaxed whitespace-pre-line">
                          {opt.desc}
                        </p>
                      )}

                      <div className="mt-auto pt-2">
                        {opt.isTicket ? (
                          <button
                            onClick={() => {
                              if (!isTicketUnlockDay) {
                                alert(
                                  "🎟️ 電子門票只限 5/11 當日開放驗票喔！\n(提示：點擊首頁上方的 🎁 測試按鈕可強制解鎖)",
                                );
                                return;
                              }
                              onToggleUsedTicket(opt.id);
                            }}
                            className={`flex items-center justify-center gap-2 w-full text-sm font-bold py-3 rounded-xl shadow-sm transition-all ${!isTicketUnlockDay ? "bg-slate-200 text-slate-400 cursor-not-allowed" : isUsed ? "bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200 active:scale-95" : "bg-teal-500 hover:bg-teal-600 text-white shadow-md active:scale-95"}`}
                          >
                            {!isTicketUnlockDay ? (
                              "⏳ 5/11 當日開放驗票"
                            ) : isUsed ? (
                              "取消標記 (復原)"
                            ) : (
                              <>
                                <CheckCircle2 size={16} /> 點擊標記為「已使用」
                              </>
                            )}
                          </button>
                        ) : opt.map ? (
                          <a
                            href={opt.map}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold py-3 rounded-xl shadow-md active:scale-95 transition-all"
                          >
                            <MapPin size={16} /> 開啟 Google Map
                          </a>
                        ) : null}

                        {/* ⛩️ 波上宮專屬：妹妹搖神籤按鈕 */}
                        {opt.isOmikuji && isBirthdayActive && (
                          <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl text-center animate-in zoom-in duration-500">
                            <p className="text-[13px] font-bold text-orange-800 mb-3 flex items-center justify-center gap-1.5">
                              <Sparkles size={14} />{" "}
                              參拜完成！妹妹來抽專屬神籤吧{" "}
                              <Sparkles size={14} />
                            </p>
                            <button
                              onClick={() => {
                                setSelectedOptions(null);
                                drawOmikuji();
                              }}
                              className="w-full bg-gradient-to-r from-orange-400 to-red-500 hover:from-orange-500 hover:to-red-600 text-white font-bold py-3 rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center gap-2"
                            >
                              ⛩️ 搖神籤！測試今日運氣
                            </button>
                            {canUseBirthdaySurprise ? (
                              <button
                                onClick={() => {
                                  setSelectedOptions(null);
                                  startLuckyDraw({
                                    scenario: "birthday",
                                    excludeSister: true,
                                    forceBirthday: true,
                                  });
                                }}
                                className="w-full mt-3 bg-gradient-to-r from-rose-400 to-pink-500 hover:from-rose-500 hover:to-pink-600 text-white font-bold py-3 rounded-xl shadow-md transition-all active:scale-95 flex justify-center items-center gap-2"
                              >
                                <Gift size={16} /> 妹妹生日驚喜抽籤
                              </button>
                            ) : (
                              <p className="mt-3 text-[11px] font-bold text-rose-500">
                                本小時的生日驚喜抽籤已使用
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 照片全螢幕放大 (Lightbox) */}
      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <button className="absolute top-6 right-4 sm:right-6 text-white/70 hover:text-white p-2">
            <X size={32} />
          </button>
          <img
            src={zoomedImage}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            alt="Fullscreen View"
          />
        </div>
      )}

      {/* 🚀 OMIKUJI 全螢幕互動求籤系統 */}
      {omikujiState.isOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          {omikujiState.step === "shaking" && (
            <div className="flex flex-col items-center animate-in fade-in duration-300">
              <div className="absolute top-20 bg-rose-500 text-white font-bold px-4 py-1.5 rounded-full animate-bounce shadow-lg flex items-center gap-2">
                <Sparkles size={16} /> 壽星妹妹 ♉✨ 專屬加成神籤
              </div>
              <div className="text-6xl animate-bounce mb-2">🔔</div>
              <div className="text-9xl animate-shake-omikuji drop-shadow-2xl">
                🏮
              </div>
              <p className="mt-8 text-white font-bold text-xl tracking-widest animate-pulse">
                神明指引中...
              </p>
            </div>
          )}

          {omikujiState.step === "falling" && (
            <div className="flex flex-col items-center relative h-64">
              <div className="text-9xl z-10 drop-shadow-2xl">🏮</div>
              <div className="absolute top-20 w-4 h-24 bg-amber-200 border-2 border-amber-700 rounded-sm animate-fall-stick z-0 shadow-md flex items-end justify-center pb-2 text-[10px] font-black text-amber-900">
                籤
              </div>
            </div>
          )}

          {omikujiState.step === "result" && omikujiState.result && (
            <>
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-[-1]">
                {[...Array(15)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute text-pink-300 opacity-80"
                    style={{
                      top: `${Math.random() * -20}%`,
                      left: `${Math.random() * 100}%`,
                      animation: `fall-sakura ${Math.random() * 2 + 2}s linear forwards`,
                      fontSize: `${Math.random() * 15 + 15}px`,
                    }}
                  >
                    🌸
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center shadow-[0_0_60px_rgba(255,255,255,0.2)] relative animate-in zoom-in-95 duration-500">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white font-bold px-4 py-1 rounded-full text-sm shadow-lg whitespace-nowrap">
                  妹妹的專屬神籤
                </div>
                <h2
                  className={`text-4xl font-black tracking-widest mt-4 mb-3 ${omikujiState.result.color} drop-shadow-sm`}
                >
                  {omikujiState.result.title}
                </h2>
                <p className="font-bold text-slate-600 mb-6 text-base">
                  {omikujiState.result.desc}
                </p>
                <div
                  className={`p-6 rounded-2xl border-2 ${omikujiState.result.bg} shadow-inner mb-6 relative overflow-hidden`}
                >
                  <div className="absolute top-0 right-0 bg-white/40 p-2 rounded-bl-2xl">
                    <Gift size={20} className={omikujiState.result.color} />
                  </div>
                  <p className="font-extrabold text-slate-800 text-[15px] leading-relaxed whitespace-pre-line text-left mt-2">
                    {omikujiState.result.prize}
                  </p>
                </div>

                {/* 🚀 判斷是否需要金主買單，並直接存入百寶袋 */}
                {needsSponsor(omikujiState.result.prize) ? (
                  <button
                    onClick={() => {
                      const resultObj = omikujiState.result;
                      setOmikujiState({
                        isOpen: false,
                        step: null,
                        result: null,
                      });
                      startSponsorDraw(resultObj); // 啟動隨機動畫的金主轉盤
                    }}
                    className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-bold py-3.5 rounded-xl shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <Dices size={20} /> 抽出買單金主並收下禮物
                  </button>
                ) : (
                  <button
                    onClick={handleAcceptPrize}
                    className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-md active:scale-95 transition-transform"
                  >
                    收下禮物 (已自動存入百寶袋)
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// --- 會計模組 ---
function AccountingView({
  expenses,
  currency,
  setCurrency,
  formatTWD,
  showExpenseForm,
  setShowExpenseForm,
  expenseForm,
  setExpenseForm,
  handleSaveExpense,
  handleDeleteExpense,
  handleToggleSplitMember,
  handleEditExpense,
  handleCloseForm,
  editingId,
  sponsorDraws,
  startSponsorDraw,
  startLuckyDraw,
  exchangeRate,
  handleOpenForm,
}) {
  const [view, setView] = useState("list");

  // 🚀 計算台幣總花費 (使用每筆帳目的專屬匯率，若無則用最新匯率)
  const totalSpentTWD = expenses.reduce((sum, exp) => {
    const rateToUse = exp.exchangeRate || exchangeRate;
    return sum + exp.amount * rateToUse;
  }, 0);

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

      <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-extrabold text-amber-800 flex items-center gap-1.5">
            <Dices size={18} /> 金主抽籤站
          </h3>
        </div>
        <p className="text-xs text-amber-700 mb-4 leading-relaxed">
          每次進入都會隨機切換玩法：一般抽籤、轉盤抽籤或終極密碼。
        </p>
        <div className="space-y-2.5 mb-4">
          <button
            onClick={() => startLuckyDraw({ scenario: "meal-free" })}
            className="w-full bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition-all"
          >
            吃飯幸運兒抽籤
          </button>
          <button
            onClick={() => startLuckyDraw({ scenario: "sponsor" })}
            className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition-all"
          >
            直接金主抽籤
          </button>
        </div>
        <button
          onClick={() => startSponsorDraw(null)}
          className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition-all mb-4"
        >
          🎲 抽出本次買單金主
        </button>

        {sponsorDraws.length > 0 && (
          <div className="bg-white/60 rounded-xl p-3 border border-amber-100">
            <p className="text-[11px] font-bold text-amber-700 mb-2">
              🏆 近期金主光榮榜
            </p>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar">
              {sponsorDraws.slice(0, 5).map((draw) => (
                <span
                  key={draw.id}
                  className="bg-white px-2.5 py-1 rounded-md text-xs font-bold text-slate-700 shadow-sm border border-slate-100 whitespace-nowrap shrink-0"
                >
                  {draw.payer} 💸
                </span>
              ))}
            </div>
          </div>
        )}
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
          {expenses.length === 0 && (
            <p className="text-center text-slate-400 py-10">
              目前還沒有記帳紀錄喔！
            </p>
          )}
          {expenses.map((exp) => {
            // 🚀 每一筆獨立計算台幣
            const rateToUse = exp.exchangeRate || exchangeRate;
            const twdAmount = Math.round(exp.amount * rateToUse);

            return (
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
                      <span className="font-bold text-sky-600">
                        {exp.payer}
                      </span>{" "}
                      先付 ➔ 分攤: {exp.splitAmong.join(", ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-rose-500 text-lg">
                      {currency === "JPY"
                        ? `¥${exp.amount.toLocaleString()}`
                        : `NT$ ${twdAmount.toLocaleString()}`}
                    </p>
                    {/* 若有自訂匯率，在旁邊顯示小提示 */}
                    {currency === "TWD" && exp.exchangeRate && (
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        匯率: {exp.exchangeRate}
                      </p>
                    )}
                  </div>
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
            );
          })}

          {!showExpenseForm ? (
            <button
              onClick={handleOpenForm}
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
                <h3 className="font-bold text-slate-800">
                  {editingId ? "編輯記帳" : "新增記帳"}
                </h3>
                <button type="button" onClick={handleCloseForm}>
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

              {/* 🚀 金額與匯率並排顯示 */}
              <div className="flex gap-3">
                <div className="flex-[2]">
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
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-500">
                    當前匯率
                  </label>
                  <input
                    required
                    type="number"
                    step="0.0001"
                    value={expenseForm.exchangeRate}
                    onChange={(e) =>
                      setExpenseForm({
                        ...expenseForm,
                        exchangeRate: e.target.value,
                      })
                    }
                    className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-200 outline-none"
                    placeholder="例如: 0.215"
                  />
                </div>
              </div>

              {/* 即時預覽台幣金額 */}
              {expenseForm.amount && expenseForm.exchangeRate && (
                <div className="text-right text-sm font-bold text-rose-500">
                  折合台幣約 NT${" "}
                  {Math.round(
                    expenseForm.amount * expenseForm.exchangeRate,
                  ).toLocaleString()}
                </div>
              )}

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
                {editingId ? "儲存修改" : "確認新增"}
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
                    折合約 NT${" "}
                    {Math.round(t.amount * exchangeRate).toLocaleString()}
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
        <p className="text-sm font-bold text-slate-500 mb-2">
          樂桃航空 (TPE → OKA)
        </p>
        <div className="flex justify-between items-center mt-4">
          <div className="text-center">
            <p className="text-3xl font-extrabold text-slate-800">09:35</p>
            <p className="text-sm font-medium text-slate-500 mt-1">
              台北 (TPE)
            </p>
          </div>
          <div className="flex-1 px-4 flex flex-col items-center">
            <p className="text-xs text-slate-400 mb-1">2h 45m</p>
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
        <p className="text-sm font-bold text-slate-500 mb-2">
          回程航班 (OKA → TPE)
        </p>
        <div className="flex justify-between items-center mt-4">
          <div className="text-center">
            <p className="text-3xl font-extrabold text-slate-800">16:50</p>
            <p className="text-sm font-medium text-slate-500 mt-1">
              那霸 (OKA)
            </p>
          </div>
          <div className="flex-1 px-4 flex flex-col items-center">
            <p className="text-xs text-slate-400 mb-1">1h 40m</p>
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

// 🚀 全新購物優惠模組
function ShoppingView() {
  const [zoomedImage, setZoomedImage] = useState(null);

  // 購物願望清單狀態 (使用 LocalStorage 記憶)
  const [shoppingList, setShoppingList] = useState(() => {
    const saved = localStorage.getItem("okinawa_shopping_list");
    return saved
      ? JSON.parse(saved)
      : {
          item1: false,
          item2: false,
          item3: false,
          item4: false,
          item5: false,
        };
  });

  const toggleItem = (key) => {
    const newList = { ...shoppingList, [key]: !shoppingList[key] };
    setShoppingList(newList);
    localStorage.setItem("okinawa_shopping_list", JSON.stringify(newList));
  };

  const wishListItems = [
    { id: "item1", name: "腳酸貼布", img: "/shopping/patch.jpg" },
    { id: "item2", name: "熱敷眼罩", img: "/shopping/eyemask.png" },
    { id: "item3", name: "無印良品布丁 🍮", img: "/shopping/pudding.jpeg" },
    {
      id: "item4",
      name: "南風堂辣味蝦餅",
      img: "/shopping/shrimp_cracker.jpg",
    },
    { id: "item5", name: "大創細毛牙刷", img: "/shopping/toothbrush.jpg" },
    { id: "item6", name: "大創防丟", img: "/shopping/tag.jpg" },
    { id: "item7", name: "沖繩海帶芽", img: "/shopping/seaweed.jpg" },
    {
      id: "item8",
      name: "石垣島辣油(小辣)",
      img: "/shopping/smallspricymild.jpg",
    },
    {
      id: "item9",
      name: "邊銀食堂蒜油\n(拌麵，水餃沾醬)",
      img: "/shopping/okinawaniniku1.jpg",
    },
  ];

  const coupons = [
    {
      name: "唐吉訶德",
      link: "https://japanportal.donki-global.com/coupon/cp001_zhtw.html",
      thresholds: [
        { spend: "1萬~3萬", off: "免稅10% + 5% OFF" },
        { spend: "3萬+", off: "免稅10% + 7% OFF" },
      ],
    },
    {
      name: "大國藥妝",
      img: "/coupon/daikoku.jpg",
      thresholds: [
        { spend: "5,000 ~ 29,999 日圓", off: "免稅 + 3% OFF" },
        { spend: "30,000 ~ 49,999 日圓", off: "免稅 + 5% OFF" },
        { spend: "50,000 日圓以上", off: "免稅 + 8% OFF" },
      ],
    },
    {
      name: "BicCamera",
      img: "/coupon/biccamera.png",
      thresholds: [
        { label: "家電 / 相機 / 手錶", off: "免稅 + 7% OFF" },
        { label: "藥品 / 化妝品 / 食品", off: "免稅 + 5% OFF" },
        { label: "日本清酒", off: "免稅 + 3% OFF" },
      ],
    },
    {
      name: "SUGI 杉藥局",
      img: "/coupon/sugi.png",
      thresholds: [
        { spend: "1萬~3萬", off: "免稅10% + 4% OFF" },
        { spend: "3萬~5萬", off: "免稅10% + 6% OFF" },
        { spend: "5萬+", off: "免稅10% + 8% OFF" },
      ],
    },
    {
      name: "松本清 Matsumoto Kiyoshi",
      img: "/coupon/matsumoto.png",
      thresholds: [
        { spend: "1萬~3萬", off: "3% OFF" },
        { spend: "3萬~5萬", off: "5% OFF" },
        { spend: "5萬+", off: "7% OFF" },
      ],
    },
    {
      name: "尚都樂客 Sundrug",
      img: "/coupon/Sundrug.jpg",
      thresholds: [
        { spend: "1萬~3萬", off: "3% OFF" },
        { spend: "3萬~5萬", off: "5% OFF" },
        { spend: "5萬+", off: "7% OFF" },
      ],
    },
    {
      name: "Cocokara Fine",
      img: "/coupon/Cocokara Fine.jpeg",
      thresholds: [
        { spend: "1萬~3萬", off: "3% OFF" },
        { spend: "3萬~5萬", off: "5% OFF" },
        { spend: "5萬+", off: "7% OFF" },
      ],
    },
    {
      name: "札幌藥妝 (北海道連鎖)",
      img: "/coupon/sapporo.png",
      thresholds: [{ spend: "無門檻", off: "免稅 + 5% OFF" }],
    },
  ];

  const normalizedCoupons = coupons.map((coupon) => {
    if (coupon.name === "BicCamera") {
      return {
        ...coupon,
        type: "category",
        discounts: [
          { label: "家電 / 相機 / 手錶 / 玩具", off: "免稅 + 7% OFF" },
          { label: "藥品 / 化妝品 / 食品 / 日用品", off: "免稅 + 5% OFF" },
          { label: "日本清酒", off: "免稅 + 3% OFF" },
        ],
        thresholds: [
          { label: "家電 / 相機 / 手錶 / 玩具", off: "免稅 + 7% OFF" },
          { label: "藥品 / 化妝品 / 食品 / 日用品", off: "免稅 + 5% OFF" },
          { label: "日本清酒", off: "免稅 + 3% OFF" },
        ],
        note: "部分商品除外，實際優惠以店鋪公告為準",
      };
    }

    return {
      ...coupon,
      type: "threshold",
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-bold text-slate-800 text-lg mb-3 flex items-center gap-2">
          <Ticket size={20} className="text-amber-500" /> 專屬優惠券
        </h2>
        {normalizedCoupons.map((coupon, idx) => (
          <div
            key={idx}
            className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4 group transition-transform"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-sky-800 text-lg">
                {coupon.name}
              </h3>
            </div>
            {coupon.type === "category" && (
              <div className="space-y-2 mb-5">
                {coupon.discounts.map((discount, i) => (
                  <div
                    key={i}
                    className="flex justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100"
                  >
                    <span className="text-sm font-medium text-slate-600">
                      <span className="font-bold text-slate-800">
                        {discount.label}
                      </span>
                    </span>
                    <span className="text-sm font-extrabold text-rose-500 text-right">
                      {discount.off}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {coupon.type !== "category" && (
            <div className="space-y-2 mb-5">
              {coupon.thresholds.map((t, i) => (
                <div
                  key={i}
                  className="flex justify-between bg-slate-50 p-3 rounded-xl border border-slate-100"
                >
                  <span className="text-sm font-medium text-slate-600">
                    滿{" "}
                    <span className="font-bold text-slate-800">{t.spend}</span>{" "}
                    日圓
                  </span>
                  <span className="text-sm font-extrabold text-rose-500">
                    {t.off}
                  </span>
                </div>
              ))}
            </div>
            )}

            {/* 判斷是給網址連結還是圖片顯示 */}
            {coupon.note && (
              <p className="mb-4 text-xs text-slate-500 leading-relaxed">
                {coupon.note}
              </p>
            )}
            {coupon.link ? (
              <a
                href={coupon.link}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-rose-50 text-rose-600 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors active:scale-95 border border-rose-200"
              >
                <Ticket size={20} /> 前往領取網頁版優惠券
              </a>
            ) : (
              <div
                className="w-full h-20 bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 border-dashed relative overflow-hidden group-hover:bg-slate-200 transition-colors cursor-zoom-in"
                onClick={() => {
                  if (coupon.img) setZoomedImage(coupon.img);
                }}
              >
                {coupon.img ? (
                  <img
                    src={coupon.img}
                    className="w-full h-full object-cover"
                    alt="coupon"
                  />
                ) : (
                  <div className="flex gap-1 items-center opacity-40">
                    <Ticket size={24} className="text-slate-500" />
                    <span className="px-2 font-bold text-sm text-slate-600">
                      點擊顯示圖片
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 🚀 日本優惠券懶人包 大按鈕 */}
      <div className="mt-6 mb-8">
        <a
          href="https://rabbitfunaround.com/blog/post/japan-coupon?gad_source=1&gad_campaignid=23076925876&gbraid=0AAAAACmBVGrUjUsNId00GWN-wp3SoUfrY&gclid=Cj0KCQjwk_bPBhDXARIsACiq8R010ok6ncZ0ISHwJqxQ3tIp9mAfppDJj8qreYwHgmhSqLOQJ_y8mkAaAnjyEALw_wcB#BicCamera_%E5%AE%B6%E9%9B%BB%E8%97%A5%E5%A6%9D"
          target="_blank"
          rel="noreferrer"
          className="w-full bg-slate-800 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
        >
          <Sparkles size={20} className="text-yellow-400" />
          查看完整「日本優惠券懶人包」
        </a>
      </div>
      {/* 血拚願望清單區塊 */}
      <div>
        <h2 className="font-bold text-slate-800 text-lg mb-3 flex items-center gap-2">
          <ShoppingBag size={20} className="text-rose-500" /> 血拚願望清單
        </h2>
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <div className="space-y-3">
            {wishListItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-4 p-3 rounded-2xl border transition-all cursor-pointer ${shoppingList[item.id] ? "bg-slate-50 border-slate-200" : "bg-white border-rose-100 shadow-sm hover:border-rose-300"}`}
                onClick={() => toggleItem(item.id)}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 shrink-0 transition-colors ${shoppingList[item.id] ? "bg-teal-500 border-teal-500" : "border-slate-300"}`}
                >
                  {shoppingList[item.id] && (
                    <CheckCircle2 size={16} className="text-white" />
                  )}
                </div>
                {/* 🚀 加入 onClick 與 e.stopPropagation()，確保點擊圖片是放大而不是打勾 */}
                <div
                  className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-200 cursor-zoom-in"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.img) setZoomedImage(item.img);
                  }}
                >
                  <img
                    src={item.img}
                    alt={item.name}
                    className={`w-full h-full object-cover transition-all ${shoppingList[item.id] ? "grayscale opacity-60" : ""}`}
                  />
                </div>
                <span
                  className={`font-bold text-[15px] flex-1 whitespace-pre-line transition-all ${shoppingList[item.id] ? "text-slate-400 line-through" : "text-slate-800"}`}
                >
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <button className="absolute top-6 right-4 sm:right-6 text-white/70 hover:text-white p-2">
            <X size={32} />
          </button>
          <img
            src={zoomedImage}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            alt="Fullscreen Image"
          />
        </div>
      )}
    </div>
  );
}
