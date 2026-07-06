'use client';

// ──────────────────────────────────────────────
// EduPay — Withdrawals & Payouts Page
// ──────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseDb, isFirebaseConfigured } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';
import {
  Building2,
  AlertTriangle,
  Loader2,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  History,
  Lock,
  ArrowRightLeft,
  XCircle,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { kobotoNaira } from '@/lib/constants';
import type { SchoolBankAccount, Withdrawal } from '@/types';

// Constants
const TRANSFER_FEE_BUFFER_NAIRA = 50;

export default function WithdrawalsPage() {
  const { user, school } = useAuth();
  
  // School bank account from context/Auth (refreshed on page loads)
  const [bankAccount, setBankAccount] = useState<SchoolBankAccount | null>(
    (school?.bankAccount as SchoolBankAccount) || null
  );

  // Lists and stats
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [liveBalanceKobo, setLiveBalanceKobo] = useState<number | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  
  // Loading states
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Form states - Bank Setup
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [previewAccount, setPreviewAccount] = useState<{
    accountName: string;
    bankName: string;
    bankCode: string;
    accountNumber: string;
  } | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);

  // Form states - Withdrawal Request
  const [withdrawAmountNaira, setWithdrawAmountNaira] = useState('');
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Polling states for 'processing' withdrawals
  const [activePollIds, setActivePollIds] = useState<string[]>([]);

  // 1. Fetch Banks List & Saved Bank Account on Mount
  useEffect(() => {
    async function loadInitialData() {
      if (!user) return;
      
      // Load saved bank account from db directly in case context is stale
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/school/bank-account', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.bankAccount) {
            setBankAccount(data.bankAccount);
          }
        }
      } catch (err) {
        console.error('Failed to load saved bank account:', err);
      }

      // Load banks list
      setLoadingBanks(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/banks', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setBanks(data.banks || []);
        } else {
          toast.error('Failed to load list of banks from Nomba');
        }
      } catch (err) {
        console.error('Failed to load banks:', err);
        toast.error('Connection error loading banks');
      } finally {
        setLoadingBanks(false);
      }
    }

    loadInitialData();
  }, [user]);

  // 2. Fetch Live Balance from Nomba
  const fetchLiveBalance = async () => {
    if (!user) return;
    setLoadingBalance(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/school/balance', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLiveBalanceKobo(data.balanceKobo);
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to fetch live balance');
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
      toast.error('Connection error fetching balance');
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLiveBalance();
    }
  }, [user]);

  // 3. Real-time Withdrawal History Listener
  useEffect(() => {
    if (!user || !isFirebaseConfigured()) {
      setLoadingHistory(false);
      return;
    }

    const db = getFirebaseDb();
    const q = query(
      collection(db, 'withdrawals'),
      where('schoolId', '==', user.uid),
      orderBy('requestedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => doc.data() as Withdrawal);
        setWithdrawals(list);
        setLoadingHistory(false);

        // Auto-detect any withdrawals stuck in 'processing' and add to polling list
        const processingIds = list
          .filter((w) => w.status === 'processing')
          .map((w) => w.id);
        
        setActivePollIds((prev) => {
          // Merge unique processing IDs
          const uniqueIds = Array.from(new Set([...prev, ...processingIds]));
          return uniqueIds;
        });
      },
      (err) => {
        console.error('History listener error:', err);
        setLoadingHistory(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 4. Polling effect for processing withdrawals
  useEffect(() => {
    if (activePollIds.length === 0 || !user) return;

    // Check status of each active ID
    const pollInterval = setInterval(async () => {
      const token = await user.getIdToken();
      
      for (const id of activePollIds) {
        try {
          const res = await fetch(`/api/withdrawals/${id}/status`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            const updated = data.withdrawal as Withdrawal;
            if (updated.status !== 'processing') {
              // Status resolved! Remove from active poll list
              setActivePollIds((prev) => prev.filter((pId) => pId !== id));
              if (updated.status === 'success') {
                toast.success(`Withdrawal of ₦${(updated.amountRequested / 100).toLocaleString()} settled successfully!`);
                fetchLiveBalance(); // refresh balance
              } else {
                toast.error(`Withdrawal of ₦${(updated.amountRequested / 100).toLocaleString()} failed: ${updated.failureReason}`);
              }
            }
          }
        } catch (err) {
          console.error(`Error polling status for ${id}:`, err);
        }
      }
    }, 6000); // poll every 6 seconds

    return () => clearInterval(pollInterval);
  }, [activePollIds, user]);

  // 5. Account Verification (POST /api/school/bank-account)
  const handleVerifyAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBankCode || !accountNumber) {
      toast.error('Please select a bank and enter account number');
      return;
    }
    setVerifyingAccount(true);
    setPreviewAccount(null);

    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/school/bank-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accountNumber,
          bankCode: selectedBankCode,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setPreviewAccount({
          accountName: data.accountName,
          bankName: data.bankName,
          bankCode: selectedBankCode,
          accountNumber,
        });
        toast.success('Account verified successfully!');
      } else {
        toast.error(data.error || 'Failed to verify bank account');
      }
    } catch (err) {
      console.error('Verify error:', err);
      toast.error('Network error verifying bank account');
    } finally {
      setVerifyingAccount(false);
    }
  };

  // 6. Confirm Payout Bank Details (POST /api/school/bank-account/confirm)
  const handleConfirmAccount = async () => {
    if (!previewAccount || !user) return;
    setSavingAccount(true);

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/school/bank-account/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(previewAccount),
      });

      const data = await res.json();
      if (res.ok) {
        setBankAccount(data.bankAccount);
        setPreviewAccount(null);
        toast.success('Payout bank account saved!');
      } else {
        toast.error(data.error || 'Failed to save bank account');
      }
    } catch (err) {
      console.error('Confirm bank error:', err);
      toast.error('Network error saving bank account');
    } finally {
      setSavingAccount(false);
    }
  };

  // 7. Request Withdrawal Submission (POST /api/withdrawals/create)
  const handleInitiateWithdrawal = async () => {
    if (!user || !bankAccount || !withdrawAmountNaira) return;
    
    setSubmittingWithdrawal(true);
    setShowConfirmModal(false);

    try {
      const amountNaira = parseFloat(withdrawAmountNaira);
      const token = await user.getIdToken();
      const res = await fetch('/api/withdrawals/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amountNaira }),
      });

      const data = await res.json();
      if (res.ok) {
        setWithdrawAmountNaira('');
        if (data.status === 'success') {
          toast.success(`Withdrawal of ₦${amountNaira.toLocaleString()} settled instantly!`);
        } else if (data.status === 'processing') {
          toast.info(`Withdrawal of ₦${amountNaira.toLocaleString()} is processing. Polling for settlement...`);
          // Add to active polling list
          setActivePollIds((prev) => [...prev, data.id]);
        }
        fetchLiveBalance(); // Update balance
      } else {
        toast.error(data.error || 'Failed to complete withdrawal');
      }
    } catch (err) {
      console.error('Withdrawal submission error:', err);
      toast.error('Connection error submitting withdrawal');
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  // Validation for withdrawal request UI
  const amountVal = parseFloat(withdrawAmountNaira);
  const isAmountValid =
    !isNaN(amountVal) &&
    amountVal > 0 &&
    liveBalanceKobo !== null &&
    amountVal * 100 <= liveBalanceKobo - TRANSFER_FEE_BUFFER_NAIRA * 100;

  // Selected bank and filtered search results
  const selectedBank = banks.find((b) => b.code === selectedBankCode);
  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <ArrowRightLeft className="h-6 w-6 text-slate-800" />
            Withdrawals & Payouts
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Withdraw collected terminal fees from Nomba sub-account directly into your bank account.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3.5 py-1 text-slate-700 bg-slate-50 border-slate-200 text-xs font-semibold select-none flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-slate-450" /> Secure Sandbox Channel
          </Badge>
        </div>
      </div>

      {/* Grid: Setup / Withdraw & Live Balance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Live Balance and Account Info details */}
        <div className="lg:col-span-1 space-y-6">
          {/* Real Live Balance Card */}
          <Card className="border-0 bg-slate-950 text-white shadow-xl rounded-[28px] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-800 opacity-90" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-450">Withdrawable Balance</span>
                <button
                  onClick={fetchLiveBalance}
                  disabled={loadingBalance}
                  className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                  title="Refresh Balance"
                >
                  <Loader2 className={`h-4 w-4 ${loadingBalance ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="mt-4">
                {liveBalanceKobo !== null ? (
                  <h3 className="text-3xl font-black tracking-tight font-mono">
                    {kobotoNaira(liveBalanceKobo)}
                  </h3>
                ) : (
                  <div className="h-9 w-40 bg-white/10 animate-pulse rounded-lg" />
                )}
                <p className="text-[10px] text-slate-400 mt-2 font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  A ₦{TRANSFER_FEE_BUFFER_NAIRA} withdrawal fee applies.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Active Saved Bank Account Info */}
          {bankAccount && (
            <Card className="border border-slate-200/60 rounded-[28px] shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-3 border-b border-slate-50">
                <CardTitle className="text-xs uppercase font-extrabold text-slate-500 tracking-wider flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-450" />
                  Destination Payout Bank
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Bank Name</label>
                  <p className="text-sm font-bold text-slate-850">{bankAccount.bankName}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Account Number</label>
                  <p className="text-sm font-black text-slate-850 font-mono tracking-wide">
                    {bankAccount.accountNumber}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400">Account Holder</label>
                  <p className="text-sm font-extrabold text-slate-850 uppercase">{bankAccount.accountName}</p>
                </div>
                <div className="pt-2 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                  <span>Verified Account</span>
                  <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border-emerald-200 px-2 py-0">
                    <CheckCircle className="h-3 w-3 mr-1" /> OK
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Panel: Bank Setup Form OR Withdraw Form */}
        <div className="lg:col-span-2">
          {!bankAccount ? (
            /* BANK ACCOUNT SETUP SECTION */
            <Card className="border border-slate-200/60 rounded-[28px] shadow-sm bg-white min-h-full">
              <CardHeader className="pb-3 border-b border-slate-50">
                <CardTitle className="text-base font-black text-slate-850 tracking-tight">
                  1. Link Payout Bank Account
                </CardTitle>
                <p className="text-xs text-slate-400 font-medium">
                  We verify your account details directly with Nomba API to prevent payout routing errors.
                </p>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {!previewAccount ? (
                  <form onSubmit={handleVerifyAccount} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="bank" className="text-xs font-bold text-slate-700">
                        Select Bank
                      </Label>
                      <button
                        id="bank"
                        type="button"
                        onClick={() => setBankDropdownOpen(true)}
                        disabled={loadingBanks}
                        className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-50 text-left"
                      >
                        <span className={selectedBank ? "text-slate-800 font-semibold" : "text-slate-400"}>
                          {loadingBanks ? 'Loading banks...' : selectedBank ? selectedBank.name : 'Choose bank'}
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="accountNumber" className="text-xs font-bold text-slate-700">
                        Account Number
                      </Label>
                      <Input
                        id="accountNumber"
                        placeholder="10-digit NUBAN number"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="h-11 rounded-xl border-slate-200"
                        maxLength={10}
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={verifyingAccount || !selectedBankCode || accountNumber.length !== 10}
                      className="w-full h-11 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-sm font-bold flex items-center justify-center gap-2"
                    >
                      {verifyingAccount ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Verifying Account...
                        </>
                      ) : (
                        'Verify Bank Account'
                      )}
                    </Button>
                  </form>
                ) : (
                  /* BANK ACCOUNT CONFIRMATION DISPLAY */
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/50 space-y-4">
                      <h4 className="text-xs font-black uppercase text-slate-450 tracking-wider">
                        Verification Results from Nomba Lookup
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                        <div>
                          <p className="text-slate-400">Verified Account Name</p>
                          <p className="text-sm font-black text-slate-850 uppercase mt-0.5">
                            {previewAccount.accountName}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Destination Bank</p>
                          <p className="text-sm font-bold text-slate-850 mt-0.5">{previewAccount.bankName}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Account Number</p>
                          <p className="text-sm font-bold font-mono text-slate-850 mt-0.5">
                            {previewAccount.accountNumber}
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-850 text-xs font-medium flex gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                        <div>
                          <p className="font-bold">Is this your correct school bank account?</p>
                          <p className="text-[11px] text-amber-700 mt-0.5">
                            We will issue all fee settlements to this exact account holder. Once confirmed, this cannot be changed without admin approval.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPreviewAccount(null)}
                        className="flex-1 h-11 rounded-xl text-slate-600 border-slate-200"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleConfirmAccount}
                        disabled={savingAccount}
                        className="flex-1 h-11 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-sm font-bold flex items-center justify-center gap-2"
                      >
                        {savingAccount ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                          </>
                        ) : (
                          'Confirm & Save Account'
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            /* WITHDRAW FUNDS SECTION */
            <Card className="border border-slate-200/60 rounded-[28px] shadow-sm bg-white min-h-full">
              <CardHeader className="pb-3 border-b border-slate-50">
                <CardTitle className="text-base font-black text-slate-850 tracking-tight">
                  Withdraw Funds
                </CardTitle>
                <p className="text-xs text-slate-400 font-medium">
                  Enter the amount you'd like to transfer to your linked bank account.
                </p>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="amount" className="text-xs font-bold text-slate-700">
                      Amount (Naira ₦)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-slate-450 font-bold font-mono">₦</span>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        value={withdrawAmountNaira}
                        onChange={(e) => setWithdrawAmountNaira(e.target.value)}
                        className="h-11 pl-8 rounded-xl border-slate-200 font-mono font-bold text-slate-800"
                        min="0"
                      />
                    </div>
                    {liveBalanceKobo !== null && (
                      <p className="text-[11px] text-slate-400 font-medium">
                        Max withdrawable: ₦
                        {Math.max(0, (liveBalanceKobo - TRANSFER_FEE_BUFFER_NAIRA * 100) / 100).toLocaleString(
                          'en-NG',
                          { minimumFractionDigits: 2 }
                        )}{' '}
                        (Account balance minus ₦{TRANSFER_FEE_BUFFER_NAIRA} fee safety margin)
                      </p>
                    )}
                  </div>

                  {withdrawAmountNaira && !isAmountValid && liveBalanceKobo !== null && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-850 text-xs font-semibold flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-650 shrink-0" />
                      <span>
                        {amountVal * 100 > liveBalanceKobo - TRANSFER_FEE_BUFFER_NAIRA * 100
                          ? 'Insufficient balance for this request.'
                          : 'Please enter a valid positive amount.'}
                      </span>
                    </div>
                  )}

                  <Button
                    onClick={() => setShowConfirmModal(true)}
                    disabled={!isAmountValid || submittingWithdrawal}
                    className="w-full h-11 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-sm font-bold flex items-center justify-center gap-2 shadow-sm"
                  >
                    Request Payout
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* active processing polling banner */}
      {activePollIds.length > 0 && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-2.5">
            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
            <div>
              <p className="font-extrabold">Settlement Processing In Progress</p>
              <p className="text-[11px] text-blue-600 mt-0.5">
                We are actively polling Nomba for transfer validation. Outbound bank settlements typically take 15 seconds to 3 minutes.
              </p>
            </div>
          </div>
          <Badge className="bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300">
            {activePollIds.length} Active
          </Badge>
        </div>
      )}

      {/* Real-time Withdrawal History Table */}
      <Card className="border border-slate-200/60 rounded-[28px] shadow-sm bg-white overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-black text-slate-850 tracking-tight flex items-center gap-2">
              <History className="h-4 w-4 text-slate-450" />
              Payout History
            </CardTitle>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Live real-time ledger of school withdrawal requests.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingHistory ? (
            <div className="p-8 flex flex-col items-center justify-center text-slate-450 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
              <span className="text-xs font-bold">Loading payment history...</span>
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-350">
                ₦
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">No payouts found</p>
                <p className="text-xs text-slate-450 mt-0.5">Once you execute a withdrawal, it will display here.</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[140px] text-xs font-bold text-slate-500">Date Requested</TableHead>
                  <TableHead className="text-xs font-bold text-slate-500">Bank Destination</TableHead>
                  <TableHead className="text-xs font-bold text-slate-500">Amount</TableHead>
                  <TableHead className="text-xs font-bold text-slate-500">Reference</TableHead>
                  <TableHead className="text-xs font-bold text-slate-500">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((w) => {
                  const dateStr = new Date(w.requestedAt).toLocaleDateString('en-NG', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const maskedAccount = `•••• ${w.bankAccount.accountNumber.slice(-4)}`;
                  
                  let statusBadge = (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                      Pending
                    </Badge>
                  );
                  if (w.status === 'processing') {
                    statusBadge = (
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1 w-max">
                        <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                        Processing
                      </Badge>
                    );
                  } else if (w.status === 'success') {
                    statusBadge = (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        Success
                      </Badge>
                    );
                  } else if (w.status === 'failed') {
                    statusBadge = (
                      <Badge className="bg-red-50 text-red-700 border-red-200" title={w.failureReason}>
                        Failed
                      </Badge>
                    );
                  }

                  return (
                    <TableRow key={w.id} className="hover:bg-slate-50/50 cursor-default">
                      <TableCell className="font-semibold text-slate-650 text-xs">
                        {dateStr}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{w.bankAccount.bankName}</p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {w.bankAccount.accountName} ({maskedAccount})
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-slate-800 text-xs">
                        {kobotoNaira(w.amountRequested)}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-slate-450 select-all">
                        {w.merchantTxRef}
                      </TableCell>
                      <TableCell>{statusBadge}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* MANDATORY TWO-STEP CONFIRMATION MODAL */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="rounded-2xl max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-850 flex items-center gap-2">
              <Lock className="h-5 w-5 text-slate-800" />
              Confirm Outbound Withdrawal
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Please double check the transaction details. This operation will transfer funds out of the system.
            </DialogDescription>
          </DialogHeader>

          {bankAccount && (
            <div className="space-y-5 pt-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-slate-200/50 pb-2">
                  <span className="text-slate-400 font-medium">Payout Amount</span>
                  <span className="text-base font-black text-slate-850 font-mono">
                    ₦{parseFloat(withdrawAmountNaira).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Destination Bank</span>
                    <span className="font-bold text-slate-800">{bankAccount.bankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Account Holder</span>
                    <span className="font-bold text-slate-850 uppercase">{bankAccount.accountName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Account Number</span>
                    <span className="font-bold font-mono text-slate-800">{bankAccount.accountNumber}</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-850 text-xs font-semibold flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  Please verify the recipient&apos;s bank details before confirming. Once your withdrawal request is submitted, it cannot be cancelled.
                </span>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 h-11 rounded-xl text-slate-650"
                  disabled={submittingWithdrawal}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleInitiateWithdrawal}
                  disabled={submittingWithdrawal}
                  className="flex-1 h-11 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold flex items-center justify-center gap-2 shadow-md"
                >
                  {submittingWithdrawal ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Transferring...
                    </>
                  ) : (
                    'Confirm Withdrawal'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SELECT DESTINATION BANK DIALOG MODAL (PORTAL LAYERED OVER EVERYTHING) */}
      <Dialog open={bankDropdownOpen} onOpenChange={setBankDropdownOpen}>
        <DialogContent className="rounded-2xl max-w-md p-6 max-h-[80vh] flex flex-col overflow-hidden bg-white">
          <DialogHeader className="pb-3 border-b border-slate-100 shrink-0">
            <DialogTitle className="text-base font-black text-slate-850 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-800" />
              Select Destination Bank
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Search and choose the bank for your school payouts.
            </DialogDescription>
          </DialogHeader>

          {/* Search Input field */}
          <div className="relative mt-4 mb-2 shrink-0">
            <input
              type="text"
              placeholder="Search bank name..."
              value={bankSearch}
              onChange={(e) => setBankSearch(e.target.value)}
              className="w-full h-11 pl-4 pr-10 rounded-xl border border-slate-200 text-sm font-semibold placeholder:text-slate-400 focus:outline-none focus:border-slate-350 focus:ring-2 focus:ring-slate-900/10 bg-white"
              autoFocus
            />
            {bankSearch && (
              <button
                type="button"
                onClick={() => setBankSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Scrollable list of banks */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 py-2">
            {filteredBanks.length > 0 ? (
              filteredBanks.map((b) => (
                <button
                  key={b.code}
                  type="button"
                  onClick={() => {
                    setSelectedBankCode(b.code);
                    setBankDropdownOpen(false);
                    setBankSearch('');
                  }}
                  className={`flex w-full items-center px-4 py-3 text-sm font-semibold rounded-xl text-left transition-all ${
                    selectedBankCode === b.code
                      ? 'bg-slate-100 text-slate-950 font-black border-l-4 border-slate-900 pl-3'
                      : 'text-slate-700 hover:bg-slate-50 border-l-4 border-transparent'
                  }`}
                >
                  {b.name}
                </button>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-slate-400 font-semibold">
                No matching banks found
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
