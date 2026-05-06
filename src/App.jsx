import React, { useState, useEffect, useMemo } from 'react';
import {
  Gem, 
  AlertCircle, 
  LogOut, 
  Calculator, 
  FileSpreadsheet, 
  MoveRight, 
  Copy, 
  Check, 
  CheckCircle2, // 修正：補上此圖示
  ArrowRightLeft, // 修正：補上此圖示
  ChevronLeft,
  Plus
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  addDoc,
  updateDoc
} from 'firebase/firestore';

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyCIt4cu_sPK4y0xjJ_dw-KKg0ba2OsGq7c",
  authDomain: "shineesplit.firebaseapp.com",
  projectId: "shineesplit",
  storageBucket: "shineesplit.firebasestorage.app",
  messagingSenderId: "457841597232",
  appId: "1:457841597232:web:1c77df491ea5fc827d46f5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = 'shinee-split-trip';

const AVATARS = [
  { icon: '🐰', name: '斤古王 (Onew)' },
  { icon: '🐶', name: '鐘狗 (Jonghyun)' },
  { icon: '🐹', name: '福實 (Key)' },
  { icon: '🐿️', name: '達拉珉 (Minho)' },
  { icon: '🐥', name: '泰麻里 (Taemin)' },
  { icon: '💎', name: '閃窩' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ name: '', avatar: '🐰' });
  const [currentView, setCurrentView] = useState('welcome');
  const [roomId, setRoomId] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.displayName && !profile.name) {
        setProfile(prev => ({ ...prev, name: currentUser.displayName }));
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      showToast("登入成功！✨");
    } catch (err) {
      showToast("Google 登入失敗", "error");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    signOut(auth);
    setRoomId(null);
    setCurrentView('welcome');
  };

  useEffect(() => {
    if (!user || !roomId) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRoomData(data);
      }
    });

    const expensesRef = collection(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId, 'expenses');
    const unsubscribeExpenses = onSnapshot(expensesRef, (snapshot) => {
      const expList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      expList.sort((a, b) => b.createdAt - a.createdAt);
      setExpenses(expList);
    });

    return () => {
      unsubscribeRoom();
      unsubscribeExpenses();
    };
  }, [user, roomId]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const createRoom = async () => {
    if (!profile.name.trim()) return showToast("請輸入暱稱", "error");
    setLoading(true);
    try {
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', newRoomId);
      await setDoc(roomRef, {
        id: newRoomId,
        createdAt: Date.now(),
        users: { [user.uid]: { uid: user.uid, name: profile.name, avatar: profile.avatar } }
      });
      setRoomId(newRoomId);
      setCurrentView('room');
    } catch (err) {
      showToast("建立失敗", "error");
    }
    setLoading(false);
  };

  const joinRoom = async (inputRoomId) => {
    if (!profile.name.trim()) return showToast("請輸入暱稱", "error");
    const targetId = inputRoomId.trim().toUpperCase();
    if (!targetId) return showToast("請輸入房間代碼", "error");
    
    setLoading(true);
    try {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', targetId);
      const roomSnap = await getDoc(roomRef);
      if (roomSnap.exists()) {
        const data = roomSnap.data();
        const updatedUsers = { ...data.users, [user.uid]: { uid: user.uid, name: profile.name, avatar: profile.avatar } };
        await updateDoc(roomRef, { users: updatedUsers });
        setRoomId(targetId);
        setCurrentView('room');
      } else {
        showToast("找不到房間", "error");
      }
    } catch (err) {
      showToast("加入失敗", "error");
    }
    setLoading(false);
  };

  if (loading && !user) return <div className="min-h-screen flex items-center justify-center bg-[#f0f9f6] text-[#88d8c0]"><Gem size={48} className="animate-spin" /></div>;
  if (!user) return <LoginView onLogin={loginWithGoogle} />;

  return (
    <div className="min-h-screen bg-[#f0f9f6] text-gray-800 font-sans">
      {toast && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center px-4 py-3 rounded-full shadow-lg ${toast.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-white text-[#4eb094]'}`}>
          {toast.type === 'error' ? <AlertCircle size={20} className="mr-2" /> : <CheckCircle2 size={20} className="mr-2 text-[#88d8c0]" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Gem className="text-[#88d8c0]" size={28} />
            <h1 className="font-bold text-xl text-gray-700">{roomId ? '閃閃一起玩 ✨' : '閃閃記帳'}</h1>
          </div>
          <button onClick={logout} className="p-2 text-gray-400 hover:text-red-400"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="max-w-md mx-auto pb-24">
        {currentView === 'welcome' && <WelcomeView profile={profile} setProfile={setProfile} onCreate={createRoom} onJoin={joinRoom} loading={loading} />}
        {currentView === 'room' && roomData && <RoomDashboard roomId={roomId} roomData={roomData} expenses={expenses} onAdd={() => setCurrentView('add_expense')} onSettle={() => setCurrentView('settle')} currentUser={user} showToast={showToast} />}
        {currentView === 'add_expense' && roomData && <AddExpenseView roomData={roomData} currentUser={user} onCancel={() => setCurrentView('room')} onSave={() => setCurrentView('room')} showToast={showToast} />}
        {currentView === 'settle' && roomData && <SettleUpView roomData={roomData} expenses={expenses} onBack={() => setCurrentView('room')} currentUser={user} />}
      </main>
    </div>
  );
}

// 子元件 (LoginView, WelcomeView, RoomDashboard, AddExpenseView 保持邏輯但修正 CheckCircle2 圖示)
// ... (中間元件略，重點在於 SettleUpView 的修復)

function SettleUpView({ roomData, expenses, onBack, currentUser }) {
  const usersArray = Object.values(roomData.users || {});
  
  const balances = useMemo(() => {
    const bal = {};
    usersArray.forEach(u => bal[u.uid] = 0);
    expenses.forEach(exp => {
      bal[exp.payerId] += Number(exp.amount);
      Object.entries(exp.splits || {}).forEach(([uid, amount]) => {
        bal[uid] -= Number(amount);
      });
    });
    return bal;
  }, [expenses, usersArray]);

  const settlements = useMemo(() => {
    const debtors = [], creditors = [];
    Object.entries(balances).forEach(([uid, amount]) => {
      if (amount < -0.01) debtors.push({ uid, amount: Math.abs(amount) });
      else if (amount > 0.01) creditors.push({ uid, amount });
    });
    const txs = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i], c = creditors[j];
      const amt = Math.min(d.amount, c.amount);
      txs.push({ from: d.uid, to: c.uid, amount: Math.round(amt) });
      d.amount -= amt; c.amount -= amt;
      if (d.amount < 0.01) i++;
      if (c.amount < 0.01) j++;
    }
    return txs;
  }, [balances]);

  const myBalance = balances[currentUser.uid] || 0;

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center mb-4">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-500"><ChevronLeft size={24} /></button>
        <h2 className="text-xl font-bold ml-2">結算帳務</h2>
      </div>

      <div className={`p-6 rounded-3xl text-white shadow-sm ${myBalance >= 0 ? 'bg-[#88d8c0]' : 'bg-[#f4a28c]'}`}>
        <p className="opacity-80">我的結算狀態</p>
        <div className="text-4xl font-black">{myBalance > 0 ? '+' : ''}{Math.round(myBalance)} 元</div>
        <p className="text-sm mt-2">{myBalance > 0 ? '收錢囉！' : myBalance < 0 ? '記得還錢！' : '帳務平衡！'}</p>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-gray-700 px-2">最佳還款方案</h3>
        {settlements.map((s, idx) => (
          <div key={idx} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-50 flex items-center justify-between">
            <div className="flex flex-col items-center flex-1">
              <div className="text-3xl mb-1">{roomData.users[s.from]?.avatar || '👤'}</div>
              <div className="text-sm font-bold text-gray-600">{roomData.users[s.from]?.name}</div>
            </div>
            <div className="flex flex-col items-center px-4 flex-1">
              <span className="text-[10px] font-bold text-[#88d8c0] mb-1 uppercase">應支付給</span>
              <div className="flex items-center text-[#ff9a8b]">
                <MoveRight size={24} strokeWidth={3} />
                <span className="text-lg font-black ml-2">${s.amount.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex flex-col items-center flex-1">
              <div className="text-3xl mb-1">{roomData.users[s.to]?.avatar || '👤'}</div>
              <div className="text-sm font-bold text-gray-600">{roomData.users[s.to]?.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ...其餘 View 元件保持不變