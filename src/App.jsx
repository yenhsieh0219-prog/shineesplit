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
  CheckCircle2,
  ArrowRightLeft,
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
        setRoomData(snapshot.data());
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

function LoginView({ onLogin }) {
  return (
    <div className="min-h-screen bg-[#f0f9f6] flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white p-10 rounded-[40px] shadow-xl text-center space-y-8">
        <div className="flex justify-center"><div className="w-24 h-24 bg-[#88d8c0] rounded-3xl flex items-center justify-center shadow-lg"><Gem size={48} className="text-white" /></div></div>
        <div className="space-y-2"><h1 className="text-3xl font-black text-gray-800">閃閃記帳</h1><p className="text-gray-500 font-medium">旅遊分帳，資料同步不遺失！</p></div>
        <button onClick={onLogin} className="w-full py-4 rounded-2xl font-bold text-gray-700 bg-white border-2 border-gray-100 shadow-sm hover:bg-gray-50 transition-all flex justify-center items-center gap-3">
          <svg className="w-6 h-6" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
          Google 帳號快速登入
        </button>
      </div>
    </div>
  );
}

function WelcomeView({ profile, setProfile, onCreate, onJoin, loading }) {
  const [joinId, setJoinId] = useState('');
  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-2 mt-4">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white shadow-md text-5xl mb-4">{profile.avatar}</div>
        <h2 className="text-2xl font-bold text-gray-800">準備好出發了嗎？</h2>
      </div>
      <div className="bg-white p-6 rounded-3xl shadow-sm space-y-6">
        <input type="text" placeholder="輸入你的暱稱" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-[#88d8c0] outline-none" />
        <div className="grid grid-cols-3 gap-3">
          {AVATARS.map((av) => (
            <button key={av.icon} onClick={() => setProfile({ ...profile, avatar: av.icon })} className={`py-3 text-2xl rounded-xl ${profile.avatar === av.icon ? 'bg-[#88d8c0] text-white shadow-md' : 'bg-gray-50'}`}>{av.icon}</button>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <button onClick={onCreate} disabled={loading} className="w-full py-4 rounded-2xl font-bold text-white bg-[#88d8c0] shadow-[0_6px_0_0_#5eb89e] active:translate-y-1 active:shadow-none flex justify-center items-center gap-2"><Plus size={20} />🏡 建立新房間</button>
        <div className="flex gap-2">
          <input type="text" placeholder="房間代碼" value={joinId} onChange={(e) => setJoinId(e.target.value.toUpperCase())} className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 text-center tracking-widest uppercase outline-none" />
          <button onClick={() => onJoin(joinId)} disabled={loading} className="px-6 py-3 rounded-2xl font-bold text-[#4eb094] bg-[#e6f7f2]">加入</button>
        </div>
      </div>
    </div>
  );
}

function RoomDashboard({ roomId, roomData, expenses, onAdd, onSettle, currentUser, showToast }) {
  const usersArray = Object.values(roomData.users || {});
  const copyRoomId = () => { navigator.clipboard.writeText(roomId).then(() => showToast("房間代碼已複製！")); };
  const myTotalPaid = expenses.filter(e => e.payerId === currentUser.uid).reduce((sum, e) => sum + Number(e.amount), 0);
  return (
    <div className="p-4 space-y-6">
      <div className="bg-[#88d8c0] p-5 rounded-3xl text-white shadow-lg flex justify-between items-start">
        <div><p className="text-teal-50 text-xs">房間代碼</p><div className="flex items-center gap-2"><span className="text-3xl font-black">{roomId}</span><button onClick={copyRoomId} className="p-1 bg-white/20 rounded-lg"><Copy size={16} /></button></div></div>
        <div className="text-right"><p className="text-teal-50 text-xs">我付出的總額</p><p className="text-2xl font-bold">${myTotalPaid.toLocaleString()}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button onClick={onAdd} className="bg-white p-6 rounded-2xl shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-all"><Plus size={32} className="text-[#4eb094]" /><b>記一筆</b></button>
        <button onClick={onSettle} className="bg-white p-6 rounded-2xl shadow-sm flex flex-col items-center gap-2 active:scale-95 transition-all"><Calculator size={32} className="text-[#f48c71]" /><b>去結算</b></button>
      </div>
      <div className="space-y-3">
        <h3 className="font-bold text-gray-700 flex items-center gap-2"><ArrowRightLeft size={18} />帳單明細</h3>
        {expenses.map(exp => (
          <div key={exp.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-gray-50">
            <div className="flex items-center gap-3"><div className="text-2xl">{roomData.users[exp.payerId]?.avatar}</div><div><p className="font-bold">{exp.title}</p><p className="text-xs text-gray-400">{roomData.users[exp.payerId]?.name} 先付</p></div></div>
            <div className="text-right"><p className="font-bold text-[#4eb094]">${Number(exp.amount).toLocaleString()}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddExpenseView({ roomData, currentUser, onCancel, onSave, showToast }) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState(currentUser.uid);
  const handleSave = async () => {
    if (!title.trim() || !amount) return showToast("資料不全", "error");
    const involvedIds = Object.keys(roomData.users);
    const splitAmount = Math.round((Number(amount) / involvedIds.length) * 100) / 100;
    const finalSplits = {};
    involvedIds.forEach(uid => finalSplits[uid] = splitAmount);
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'rooms', roomData.id, 'expenses'), {
      title, amount: Number(amount), payerId, splits: finalSplits, createdAt: Date.now()
    });
    showToast("記帳成功！"); onSave();
  };
  return (
    <div className="p-4 space-y-6 animate-in slide-in-from-right-4">
      <div className="flex items-center"><button onClick={onCancel} className="p-2"><ChevronLeft size={24} /></button><h2 className="text-xl font-bold ml-2">新增記帳</h2></div>
      <div className="bg-white p-6 rounded-3xl space-y-4 shadow-sm">
        <input type="text" placeholder="買了什麼？" value={title} onChange={e => setTitle(e.target.value)} className="w-full text-xl font-bold border-b-2 border-gray-100 py-2 outline-none focus:border-[#88d8c0]" />
        <input type="number" placeholder="金額" value={amount} onChange={e => setAmount(e.target.value)} className="w-full text-3xl font-black text-[#4eb094] outline-none" />
      </div>
      <button onClick={handleSave} className="w-full py-4 bg-[#88d8c0] text-white rounded-2xl font-bold shadow-lg">儲存紀錄</button>
    </div>
  );
}

function SettleUpView({ roomData, expenses, onBack, currentUser }) {
  const usersArray = Object.values(roomData.users || {});
  const balances = useMemo(() => {
    const bal = {}; usersArray.forEach(u => bal[u.uid] = 0);
    expenses.forEach(exp => {
      bal[exp.payerId] += Number(exp.amount);
      Object.entries(exp.splits || {}).forEach(([uid, amount]) => { bal[uid] -= Number(amount); });
    });
    return bal;
  }, [expenses, usersArray]);
  const settlements = useMemo(() => {
    const debtors = [], creditors = [];
    Object.entries(balances).forEach(([uid, amount]) => {
      if (amount < -0.01) debtors.push({ uid, amount: Math.abs(amount) });
      else if (amount > 0.01) creditors.push({ uid, amount });
    });
    const txs = []; let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i], c = creditors[j];
      const amt = Math.min(d.amount, c.amount);
      txs.push({ from: d.uid, to: c.uid, amount: Math.round(amt) });
      d.amount -= amt; c.amount -= amt;
      if (d.amount < 0.01) i++; if (c.amount < 0.01) j++;
    }
    return txs;
  }, [balances]);
  const myBalance = balances[currentUser.uid] || 0;
  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center"><button onClick={onBack} className="p-2"><ChevronLeft size={24} /></button><h2 className="text-xl font-bold ml-2">結算帳務</h2></div>
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
              <div className="text-3xl mb-1">{roomData.users[s.from]?.avatar}</div>
              <div className="text-sm font-bold text-gray-600">{roomData.users[s.from]?.name}</div>
            </div>
            <div className="flex flex-col items-center px-4 flex-1">
              <span className="text-[14px] font-bold text-[#88d8c0] mb-1 uppercase">應支付給</span>
              <div className="flex items-center text-[#ff9a8b]">
                <MoveRight size={24} strokeWidth={3} />
                <span className="text-lg font-black ml-2">${s.amount.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex flex-col items-center flex-1">
              <div className="text-3xl mb-1">{roomData.users[s.to]?.avatar}</div>
              <div className="text-sm font-bold text-gray-600">{roomData.users[s.to]?.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}