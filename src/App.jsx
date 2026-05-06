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
} from "lucide-react";
import { db } from "./services/firebase";
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

export default function OkinawaTravelApp() {
  const [activeTab, setActiveTab] = useState("itinerary");
  const [showBirthday, setShowBirthday] = useState(false);
  const [currency, setCurrency] = useState("JPY");

  // API States
  const [exchangeRate, setExchangeRate] = useState(0.21);
  const [weatherData, setWeatherData] = useState({});
  const [editingId, setEditingId] = useState(null);

  // 帳務 State
  const [expenses, setExpenses] = useState([]);

  // 飯店房號 State
  const [rooms, setRooms] = useState(() => {
    const saved = localStorage.getItem("okinawa_rooms");
    return saved ? JSON.parse(saved) : { montpa: "", urbansea: "" };
  });

  // 🚀 新增：電子門票使用狀態 State (存在 LocalStorage)
  const [usedTickets, setUsedTickets] = useState(() => {
    const saved = localStorage.getItem("okinawa_tickets");
    return saved ? JSON.parse(saved) : {};
  });

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    title: "",
    amount: "",
    payer: "我",
    splitAmong: [...FAMILY_MEMBERS],
  });

  useEffect(() => {
    localStorage.setItem("okinawa_rooms", JSON.stringify(rooms));
  }, [rooms]);

  // 🚀 新增：監聽門票狀態改變並存入 LocalStorage
  useEffect(() => {
    localStorage.setItem("okinawa_tickets", JSON.stringify(usedTickets));
  }, [usedTickets]);

  useEffect(() => {
    const docRef = doc(db, "shared_data", "rooms");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setRooms(docSnap.data());
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expenseData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setExpenses(expenseData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetch("https://api.exchangerate-api.com/v4/latest/JPY")
      .then((res) => res.json())
      .then((data) => setExchangeRate(data.rates.TWD))
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

  useEffect(() => {
    const today = new Date();
    if (today.getMonth() === 4 && today.getDate() === 13) {
      setShowBirthday(true);
    }
  }, []);

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

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount) return;

    const dataToSave = { ...expenseForm };
    const currentEditId = editingId;

    setShowExpenseForm(false);
    setEditingId(null);
    setExpenseForm({
      title: "",
      amount: "",
      payer: "我",
      splitAmong: [...FAMILY_MEMBERS],
    });

    try {
      if (currentEditId) {
        const docRef = doc(db, "expenses", currentEditId);
        await updateDoc(docRef, {
          ...dataToSave,
          amount: Number(dataToSave.amount),
        });
      } else {
        await addDoc(collection(db, "expenses"), {
          ...dataToSave,
          amount: Number(dataToSave.amount),
          createdAt: Date.now(),
        });
      }
    } catch (error) {
      console.error("寫入失敗：", error);
      alert(`Firebase 寫入失敗！\n錯誤訊息：${error.message}`);
    }
  };

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

  const handleDeleteExpense = async (id) => {
    if (window.confirm("確定要刪除這筆帳目嗎？")) {
      try {
        await deleteDoc(doc(db, "expenses", id));
      } catch (error) {
        alert(`刪除失敗：${error.message}`);
      }
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

  const formatTWD = (jpy) =>
    `NT$ ${Math.round(jpy * exchangeRate).toLocaleString()}`;
  const totalPublicSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);

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
      `}</style>

      {showBirthday && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 text-center shadow-2xl relative animate-bounce">
            <button
              onClick={() => setShowBirthday(false)}
              className="absolute top-4 right-4 text-slate-400"
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

      <header className="bg-gradient-to-r from-[#93C5FD] to-[#A5F3FC] p-5 rounded-b-3xl shadow-sm sticky top-0 z-40">
        <div className="flex justify-between items-center text-slate-800">
          <div>
            <h1 className="text-xl font-extrabold tracking-wider">
              🌺 沖繩家族旅行
            </h1>
            <p className="text-sm font-medium opacity-90">5/10 - 5/15</p>
          </div>
          <div
            onClick={() => setActiveTab("accounting")}
            className="bg-white/40 backdrop-blur-md px-3 py-2 rounded-2xl flex items-center gap-2 cursor-pointer border border-white/50 shadow-sm"
          >
            <PiggyBank size={24} className="text-amber-500" />
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-600">總花費</p>
              <p className="font-extrabold text-sm">
                {currency === "JPY"
                  ? `¥ ${totalPublicSpent.toLocaleString()}`
                  : formatTWD(totalPublicSpent)}
              </p>
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
            />
          </div>
        )}
        {activeTab === "flights" && (
          <div className="p-4">
            <FlightsView />
          </div>
        )}
        {activeTab === "coupons" && (
          <div className="p-4">
            <CouponsView />
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
  setUsedTickets,
}) {
  const [selectedOptions, setSelectedOptions] = useState(null);
  const [activeDay, setActiveDay] = useState(0);
  const [isEditingRooms, setIsEditingRooms] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);

  const handleSaveRooms = async () => {
    setIsEditingRooms(false);
    try {
      await setDoc(doc(db, "shared_data", "rooms"), rooms);
    } catch (error) {
      console.error("儲存房號失敗：", error);
      alert("儲存房號失敗，請檢查網路連線。");
    }
  };

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
          type: "spot",
          time: "13:00",
          title: "美麗海水族館",
          desc: "預計停留 1.5hr",
          // 🚀 升級：加上 id 與 isTicket 屬性
          options: [
            {
              name: "門票 - 爸爸",
              img: "/tickets/ticket1.jpg",
              id: "ticket-papa",
              isTicket: true,
            },
            {
              name: "門票 - 媽媽",
              img: "/tickets/ticket1.jpg",
              id: "ticket-mama",
              isTicket: true,
            },
            {
              name: "門票 - 妹妹",
              img: "/tickets/ticket1.jpg",
              id: "ticket-sister",
              isTicket: true,
            },
            {
              name: "門票 - 書瑋",
              img: "/tickets/ticket1.jpg",
              id: "ticket-shuwei",
              isTicket: true,
            },
            {
              name: "門票 - Candy",
              img: "/tickets/ticket1.jpg",
              id: "ticket-candy",
              isTicket: true,
            },
          ],
        },
        {
          type: "info",
          time: "14:30 / 16:00",
          title: "🐬 海豚秀",
          desc: "在水族館戶外展區",
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
              name: "琉球之牛",
              desc: "牛舌推薦，可以直接點套餐。",
              map: "https://maps.google.com/?q=琉球之牛+那霸",
              note: "🚨 預約確認號碼：5C2H4G！遲到15分鐘會直接取消！",
              img: "/food/kyuniku.jpg",
            },
          ],
        },
        {
          type: "shopping",
          title: "逛街",
          desc: "點擊查看訂位資訊與備註",
          options: [
            {
              name: "唐吉訶德",
              desc: "牛舌推薦，可以直接點套餐。\n吃完後逛唐吉訶德 那霸壺川店 (人少走道寬好逛)\n\n🛒 伴手禮推薦：涼糖、乳液、Glico 醬油扇貝百力滋",
              map: "https://maps.google.com/?q=琉球之牛+那霸",
              coupon:
                "https://japanportal.donki-global.com/coupon/cp001_zhtw.html",
              buyList: [
                {
                  name: "VICKS 涼糖",
                  img: "/source/vicks.jpg",
                  alert: "檢查效期",
                },
                {
                  name: "Glico 百力滋",
                  desc: "日式醬油扇貝，阿瞳點心",
                  img: "/shopping/pretz.jpg",
                },
              ],
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
                className={`min-w-[85px] snap-start cursor-pointer rounded-[20px] py-3 px-2 flex flex-col items-center transition-all border-2 
                  ${isActive ? "border-sky-500 bg-white shadow-sm" : "border-transparent bg-white shadow-sm opacity-70"}`}
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
                                {getModalIcon(item.type, 14)}
                                點擊查看 {item.options.length} 項內容
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
                {getModalIcon(selectedOptions.type, 20)}
                {selectedOptions.title}
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
                // 🚀 判斷這張卡片是不是電子門票，以及它的使用狀態
                const isUsed = opt.isTicket && usedTickets[opt.id];

                return (
                  <div
                    key={i}
                    className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200 flex flex-col"
                  >
                    {opt.img && (
                      <div className="h-40 bg-slate-100 flex items-center justify-center relative overflow-hidden group shrink-0">
                        <img
                          src={opt.img}
                          alt={opt.name}
                          className={`w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition-transform duration-300 ${isUsed ? "grayscale opacity-30" : ""}`}
                          onClick={() => setZoomedImage(opt.img)}
                        />
                        {/* 🚀 已使用印章效果 */}
                        {isUsed && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <span className="bg-slate-800/80 text-white font-black tracking-widest text-3xl px-6 py-2 border-4 border-white/80 transform -rotate-12 rounded-lg backdrop-blur-sm shadow-xl">
                              USED
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
                          <AlertCircle size={14} className="shrink-0 mt-0.5" />
                          <span>{opt.note}</span>
                        </div>
                      )}

                      {opt.desc && (
                        <p className="text-sm text-slate-500 mb-4 leading-relaxed whitespace-pre-line">
                          {opt.desc}
                        </p>
                      )}

                      {opt.buyList && opt.buyList.length > 0 && (
                        <div className="flex overflow-x-auto gap-3 pb-3 mb-2 hide-scrollbar">
                          {opt.buyList.map((item, itemIdx) => (
                            <div
                              key={itemIdx}
                              className="flex flex-col items-center w-[80px] shrink-0"
                            >
                              <div
                                className="w-16 h-16 bg-white rounded-xl overflow-hidden mb-2 shadow-sm border border-slate-100 flex items-center justify-center cursor-zoom-in"
                                onClick={() =>
                                  item.img && setZoomedImage(item.img)
                                }
                              >
                                {item.img ? (
                                  <img
                                    src={item.img}
                                    className="w-full h-full object-cover"
                                    alt={item.name}
                                  />
                                ) : (
                                  <ShoppingBag
                                    size={20}
                                    className="text-slate-300"
                                  />
                                )}
                              </div>
                              <span className="text-[11px] font-bold text-slate-700 text-center leading-tight whitespace-pre-wrap">
                                {item.name}
                              </span>
                              {item.desc && (
                                <span className="text-[9px] text-slate-500 text-center leading-tight mt-0.5">
                                  {item.desc}
                                </span>
                              )}
                              {item.alert && (
                                <span className="mt-1.5 bg-rose-50 text-rose-600 text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                  <AlertCircle size={10} /> {item.alert}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-auto pt-2">
                        {/* 🚀 如果是電子門票，顯示切換使用狀態的專屬按鈕 */}
                        {opt.isTicket ? (
                          <button
                            onClick={() =>
                              setUsedTickets((prev) => ({
                                ...prev,
                                [opt.id]: !prev[opt.id],
                              }))
                            }
                            className={`flex items-center justify-center gap-2 w-full text-sm font-bold py-3 rounded-xl shadow-sm active:scale-95 transition-all ${
                              isUsed
                                ? "bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200"
                                : "bg-teal-500 hover:bg-teal-600 text-white shadow-md"
                            }`}
                          >
                            {isUsed ? (
                              "取消標記 (復原)"
                            ) : (
                              <>
                                <CheckCircle2 size={16} />
                                點擊標記為「已使用」
                              </>
                            )}
                          </button>
                        ) : opt.coupon ? (
                          <div className="flex gap-2">
                            <a
                              href={opt.map}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-bold py-3 rounded-xl transition-colors border border-emerald-100 active:scale-95"
                            >
                              <MapPin size={16} /> 開啟地圖
                            </a>
                            <a
                              href={opt.coupon}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-sm font-bold py-3 rounded-xl transition-colors border border-rose-100 active:scale-95"
                            >
                              <Ticket size={16} /> 領取優惠券
                            </a>
                          </div>
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
    </div>
  );
}

// --- 會計、航班、優惠券模組保持不變 ---
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
}) {
  const [view, setView] = useState("list");

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
                    先付 ➔ 分攤: {exp.splitAmong.join(", ")}
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

function CouponsView() {
  const [zoomedCoupon, setZoomedCoupon] = useState(null);

  const coupons = [
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
      name: "札幌藥妝 (北海道連鎖)",
      img: "/coupon/sapporo.png",
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
          className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4 group transition-transform"
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
          <div className="w-full h-16 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200 border-dashed relative overflow-hidden group-hover:bg-slate-200 transition-colors cursor-zoom-in">
            {coupon.img ? (
              <img
                src={coupon.img}
                className="w-full h-full object-cover"
                alt="coupon"
                onClick={() => setZoomedCoupon(coupon.img)}
              />
            ) : (
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
            )}
          </div>
        </div>
      ))}

      {/* 優惠券全螢幕放大 (Lightbox) */}
      {zoomedCoupon && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
          onClick={() => setZoomedCoupon(null)}
        >
          <button className="absolute top-6 right-4 sm:right-6 text-white/70 hover:text-white p-2">
            <X size={32} />
          </button>
          <img
            src={zoomedCoupon}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            alt="Fullscreen Coupon"
          />
        </div>
      )}
    </div>
  );
}
