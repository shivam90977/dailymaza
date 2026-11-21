import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  serverTimestamp,
  onSnapshot,
  addDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// =====================================
// FIREBASE CONFIG
// =====================================

const firebaseConfig = {
  apiKey: "AIzaSyDX-Xzc74FDstuTsi7goxPvOHa-9D8uqyk",
  authDomain: "dailymaza-313e9.firebaseapp.com",
  projectId: "dailymaza-313e9",
  storageBucket: "dailymaza-313e9.firebasestorage.app",
  messagingSenderId: "592031280830",
  appId: "1:592031280830:web:cd57023541bb9111a4f8ef",
  measurementId: "G-Y2FKDQREPT"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const MIN_WITHDRAWAL = 50;

const referralCode = new URLSearchParams(
  window.location.search
).get("ref");

const $ = (id) => document.getElementById(id);

// =====================================
// GLOBAL VARIABLES
// =====================================

let isSignup = false;
let currentUser = null;
let settingsUnsubscribe = null;
let withdrawalUnsubscribe = null;
let currentBalance = 0;

// =====================================
// AUTH ELEMENTS
// =====================================

const loginBtn = $("loginBtn");
const logoutBtn = $("logoutBtn");
const authModal = $("authModal");
const authForm = $("authForm");
const authTitle = $("authTitle");
const authSubmit = $("authSubmit");
const authSwitch = $("authSwitch");
const switchLabel = $("switchLabel");
const nameGroup = $("nameGroup");
const userName = $("userName");
const userEmail = $("userEmail");
const userPassword = $("userPassword");
const authMessage = $("authMessage");

// =====================================
// AUTH MODAL
// =====================================

function openAuthModal() {
  if (!authModal) return;

  authModal.hidden = false;
  authModal.classList.add("active");

  if (authMessage) {
    authMessage.textContent = "";
  }
}

function closeAuthModal() {
  if (!authModal) return;

  authModal.classList.remove("active");
  authModal.hidden = true;

  authForm?.reset();

  isSignup = false;
  updateAuthMode();
}

function updateAuthMode() {
  if (authTitle) {
    authTitle.textContent = isSignup
      ? "Create Account"
      : "Login to DailyMaza";
  }

  if (authSubmit) {
    authSubmit.textContent = isSignup
      ? "Sign Up"
      : "Login";
  }

  if (authSwitch) {
    authSwitch.textContent = isSignup
      ? "Login"
      : "Sign Up";
  }

  if (switchLabel) {
    switchLabel.textContent = isSignup
      ? "Already have an account?"
      : "Don't have an account?";
  }

  if (nameGroup) {
    nameGroup.hidden = !isSignup;
  }

  if (userName) {
    userName.required = isSignup;
  }
}

loginBtn?.addEventListener("click", openAuthModal);

$("getStartedBtn")?.addEventListener(
  "click",
  openAuthModal
);

$("closeModal")?.addEventListener(
  "click",
  closeAuthModal
);

authSwitch?.addEventListener("click", () => {
  isSignup = !isSignup;

  if (authMessage) {
    authMessage.textContent = "";
  }

  updateAuthMode();
});

// =====================================
// CREATE USER PROFILE
// =====================================

async function createUserProfile(user, name = "") {
  const userRef = doc(db, "users", user.uid);

  const profile = await getDoc(userRef);

  if (!profile.exists()) {
    await setDoc(userRef, {
      name:
        name ||
        user.displayName ||
        user.email.split("@")[0],

      email: user.email,
      balance: 0,
      completedTasks: 0,
      referrals: 0,
      createdAt: serverTimestamp()
    });
  }

  return userRef;
}

// =====================================
// SAVE REFERRAL ATTRIBUTION
// =====================================

async function saveReferralAttribution(user) {
  if (!referralCode) return;

  const inviterUid = referralCode.trim();

  if (!inviterUid || inviterUid === user.uid) {
    console.log("Invalid or self referral skipped.");
    return;
  }

  try {
    const referralRef = doc(
      db,
      "referrals",
      user.uid
    );

    const existingReferral = await getDoc(
      referralRef
    );

    if (existingReferral.exists()) return;

    await setDoc(referralRef, {
      inviterUid,
      referredUid: user.uid,
      createdAt: serverTimestamp(),
      status: "pending"
    });

    console.log("Referral successfully recorded!");

  } catch (error) {
    console.error(
      "Referral tracking error:",
      error
    );
  }
}

// =====================================
// LOGIN / SIGNUP
// =====================================

authForm?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const email = userEmail.value.trim();
    const password = userPassword.value;
    const name = userName.value.trim();

    authSubmit.disabled = true;
    authMessage.textContent = "Please wait...";

    try {
      if (isSignup) {
        if (!name) {
          throw new Error("Please enter your name.");
        }

        const result =
          await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );

        await updateProfile(result.user, {
          displayName: name
        });

        await createUserProfile(
          result.user,
          name
        );

        await saveReferralAttribution(
          result.user
        );

        closeAuthModal();

      } else {
        const result =
          await signInWithEmailAndPassword(
            auth,
            email,
            password
          );

        await createUserProfile(result.user);

        closeAuthModal();
      }

    } catch (error) {
      console.error(
        "Authentication error:",
        error
      );

      authMessage.textContent = error.message;

    } finally {
      authSubmit.disabled = false;
    }
  }
);

// =====================================
// LOGOUT
// =====================================

logoutBtn?.addEventListener(
  "click",
  async () => {
    try {
      await signOut(auth);

    } catch (error) {
      alert(error.message);
    }
  }
);

// =====================================
// WALLET DISPLAY
// =====================================

function updateBalanceDisplay(balance) {
  currentBalance = Number(balance || 0);

  const formatted =
    "₹" + currentBalance.toFixed(2);

  if ($("dashboardWalletBalance")) {
    $("dashboardWalletBalance").textContent =
      formatted;
  }

  if ($("walletBalance")) {
    $("walletBalance").textContent =
      formatted;
  }

  if ($("withdrawAvailableBalance")) {
    $("withdrawAvailableBalance").textContent =
      formatted;
  }
}

// =====================================
// LOAD USER DATA
// =====================================

async function loadUserData(user) {
  const userRef = doc(db, "users", user.uid);

  let profileSnap = await getDoc(userRef);

  if (!profileSnap.exists()) {
    await createUserProfile(user);
    profileSnap = await getDoc(userRef);
  }

  const data = profileSnap.data();

  $("dashboardUserName").textContent =
    data.name ||
    user.displayName ||
    "User";

  updateBalanceDisplay(data.balance);

  $("referralCount").textContent =
    data.referrals || 0;

  $("referralTaskCount").textContent =
    data.referrals || 0;

  $("referralLink").value =
    window.location.origin +
    window.location.pathname +
    "?ref=" +
    user.uid;

  await loadTaskHistory(user);

  // Start real-time withdrawal history
  listenToWithdrawalHistory(user);
}

// =====================================
// AUTH STATE
// =====================================

onAuthStateChanged(
  auth,
  async (user) => {
    currentUser = user;

    loginBtn.hidden = !!user;
    logoutBtn.hidden = !user;

    $("userDashboard").hidden = !user;

    if (user) {
      try {
        await loadUserData(user);

      } catch (error) {
        console.error(
          "Dashboard error:",
          error
        );
      }

    } else {
      // Stop previous user's listener
      if (withdrawalUnsubscribe) {
        withdrawalUnsubscribe();
        withdrawalUnsubscribe = null;
      }

      $("dashboardUserName").textContent =
        "User";

      updateBalanceDisplay(0);

      $("dashboardCompletedTasks").textContent =
        "0";

      $("referralCount").textContent = "0";
      $("referralTaskCount").textContent = "0";

      $("referralLink").value = "";

      $("historyStatus").textContent =
        "Login to view your activity.";

      $("historyList").innerHTML = "";

      $("withdrawalHistoryStatus").textContent =
        "Login to view withdrawal history.";

      $("withdrawalHistoryList").innerHTML = "";

      $("withdrawalMessage").textContent = "";

      $("referralMessage").textContent = "";
    }
  }
);

// =====================================
// TASK REWARD SETTINGS LIVE SYNC
// =====================================

function listenToTaskSettings() {
  if (settingsUnsubscribe) {
    settingsUnsubscribe();
  }

  settingsUnsubscribe = onSnapshot(
    doc(db, "settings", "tasks"),

    (snapshot) => {
      if (!snapshot.exists()) return;

      const settings = snapshot.data();

      $("surveyReward").textContent =
        "₹" + Number(settings.survey || 0).toFixed(2);

      $("videoReward").textContent =
        "₹" + Number(settings.video || 0).toFixed(2);

      $("referralReward").textContent =
        "₹" + Number(settings.referral || 0).toFixed(2);

      $("rewardSyncStatus").textContent =
        "Rewards updated successfully.";
    },

    (error) => {
      console.error(
        "Settings sync error:",
        error
      );

      $("rewardSyncStatus").textContent =
        "Reward sync unavailable.";
    }
  );
}

listenToTaskSettings();

// =====================================
// TASK ACTIVITY HISTORY
// =====================================

async function loadTaskHistory(user) {
  const historyList = $("historyList");
  const historyStatus = $("historyStatus");

  historyStatus.textContent =
    "Loading activity...";

  historyList.innerHTML = "";

  try {
    const taskCollection = collection(
      db,
      "users",
      user.uid,
      "taskCompletions"
    );

    const [
      taskSnapshot,
      settingsSnapshot
    ] = await Promise.all([
      getDocs(taskCollection),

      getDoc(
        doc(db, "settings", "tasks")
      )
    ]);

    const settings = settingsSnapshot.exists()
      ? settingsSnapshot.data()
      : {};

    const rewards = {
      survey: Number(settings.survey || 0),
      video: Number(settings.video || 0)
    };

    $("dashboardCompletedTasks").textContent =
      taskSnapshot.size;

    const activities = [];

    // TASK ACTIVITIES
    taskSnapshot.forEach((taskDoc) => {
      const task = taskDoc.data();

      const taskId =
        task.taskId || taskDoc.id;

      const taskName =
        taskId === "survey"
          ? "Survey Task"
          : taskId === "video"
          ? "Video Task"
          : taskId.toUpperCase();

      activities.push({
        name: taskName,
        type: "task",
        reward: rewards[taskId] || 0,
        status: "Completed",
        date: task.completedAt
      });
    });

    // REFERRAL HISTORY
    try {
      const referralSnapshot = await getDoc(
        doc(db, "referrals", user.uid)
      );

      if (referralSnapshot.exists()) {
        const referral = referralSnapshot.data();

        activities.push({
          name: "Referral Signup",
          type: "referral",
          reward: 0,

          status:
            referral.status === "approved"
              ? "Approved"
              : referral.status === "rejected"
              ? "Rejected"
              : "Pending",

          date: referral.createdAt
        });
      }

    } catch (referralError) {
      console.log(
        "Referral history unavailable:",
        referralError.message
      );
    }

    // SORT ACTIVITIES
    activities.sort((a, b) => {
      const dateA = a.date?.toDate
        ? a.date.toDate().getTime()
        : 0;

      const dateB = b.date?.toDate
        ? b.date.toDate().getTime()
        : 0;

      return dateB - dateA;
    });

    if (activities.length === 0) {
      historyStatus.textContent =
        "No activity yet. Complete your first task!";

      return;
    }

    historyStatus.textContent =
      "Your activity and reward history:";

    let totalDemoRewards = 0;

    activities.forEach((activity) => {
      if (activity.status === "Completed") {
        totalDemoRewards += activity.reward;
      }

      const item = document.createElement("div");
      item.className = "history-item";

      const title = document.createElement("strong");
      title.textContent = activity.name;

      const reward = document.createElement("span");
      reward.textContent =
        "₹" + Number(activity.reward).toFixed(2);

      const status = document.createElement("span");
      status.textContent = activity.status;

      const details = document.createElement("p");

      details.textContent =
        activity.type === "referral"
          ? "Referral attribution"
          : "Demo task completed";

      item.append(
        title,
        reward,
        status,
        details
      );

      historyList.appendChild(item);
    });

    // TOTAL DEMO REWARDS
    const totalItem = document.createElement("div");
    totalItem.className = "history-item";

    const totalTitle = document.createElement("strong");
    totalTitle.textContent = "Total Demo Rewards";

    const totalAmount = document.createElement("span");
    totalAmount.textContent =
      "₹" + totalDemoRewards.toFixed(2);

    totalItem.append(
      totalTitle,
      totalAmount
    );

    historyList.appendChild(totalItem);

  } catch (error) {
    console.error("History error:", error);

    historyStatus.textContent =
      "Could not load activity.";
  }
}

// =====================================
// DATE FORMAT
// =====================================

function formatDate(timestamp) {
  if (!timestamp?.toDate) {
    return "Date unavailable";
  }

  return timestamp.toDate().toLocaleString("en-IN");
}

// =====================================
// CREATE WITHDRAWAL HISTORY CARD
// =====================================

function createWithdrawalHistoryItem(withdrawal) {
  const item = document.createElement("div");

  item.className = "history-item";

  const title = document.createElement("strong");

  title.textContent =
    "Withdrawal Request — ₹" +
    Number(withdrawal.amount || 0).toFixed(2);

  const upi = document.createElement("p");

  upi.textContent =
    "UPI ID: " +
    (withdrawal.upiId || "Not available");

  const status = document.createElement("span");

  const statusValue =
    String(withdrawal.status || "pending").toLowerCase();

  status.className =
    "status " + statusValue;

  status.textContent =
    statusValue.charAt(0).toUpperCase() +
    statusValue.slice(1);

  const date = document.createElement("p");

  date.textContent =
    "Requested: " +
    formatDate(withdrawal.requestedAt);

  item.append(
    title,
    upi,
    status,
    date
  );

  return item;
}

// =====================================
// REAL-TIME WITHDRAWAL HISTORY
// =====================================

function listenToWithdrawalHistory(user) {
  // Remove previous listener
  if (withdrawalUnsubscribe) {
    withdrawalUnsubscribe();
    withdrawalUnsubscribe = null;
  }

  const historyList = $("withdrawalHistoryList");
  const historyStatus = $("withdrawalHistoryStatus");

  if (!historyList || !historyStatus) {
    console.error(
      "Withdrawal history HTML elements not found."
    );

    return;
  }

  historyStatus.textContent =
    "Loading withdrawal history...";

  historyList.innerHTML = "";

  const withdrawalQuery = query(
    collection(db, "withdrawals"),
    where("userId", "==", user.uid)
  );

  withdrawalUnsubscribe = onSnapshot(
    withdrawalQuery,

    (snapshot) => {
      historyList.innerHTML = "";

      if (snapshot.empty) {
        historyStatus.textContent =
          "You have no withdrawal requests yet.";

        return;
      }

      const requests = [];

      snapshot.forEach((withdrawalDoc) => {
        requests.push(withdrawalDoc.data());
      });

      requests.sort((a, b) => {
        const dateA = a.requestedAt?.toDate
          ? a.requestedAt.toDate().getTime()
          : 0;

        const dateB = b.requestedAt?.toDate
          ? b.requestedAt.toDate().getTime()
          : 0;

        return dateB - dateA;
      });

      historyStatus.textContent =
        "Your withdrawal requests:";

      requests.forEach((withdrawal) => {
        historyList.appendChild(
          createWithdrawalHistoryItem(withdrawal)
        );
      });
    },

    (error) => {
      console.error(
        "Withdrawal listener error:",
        error
      );

      historyStatus.textContent =
        "Could not load withdrawal history: " +
        error.message;
    }
  );
}

// =====================================
// SUBMIT WITHDRAWAL REQUEST
// =====================================

$("withdrawalForm")?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const message = $("withdrawalMessage");
    const submitButton = $("withdrawSubmit");

    if (!currentUser) {
      message.textContent =
        "Please login first.";

      openAuthModal();
      return;
    }

    const amount = Number(
      $("withdrawAmount").value
    );

    const upiId = $("withdrawUpi").value.trim();

    if (
      !Number.isFinite(amount) ||
      amount < MIN_WITHDRAWAL
    ) {
      message.textContent =
        "Minimum withdrawal amount is ₹50.";

      return;
    }

    if (
      !/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test(upiId)
    ) {
      message.textContent =
        "Please enter a valid UPI ID.";

      return;
    }

    submitButton.disabled = true;

    message.textContent =
      "Submitting your request...";

    try {
      // Get latest wallet balance
      const userRef = doc(
        db,
        "users",
        currentUser.uid
      );

      const userSnapshot = await getDoc(userRef);

      if (!userSnapshot.exists()) {
        throw new Error("User profile not found.");
      }

      const latestBalance = Number(
        userSnapshot.data().balance || 0
      );

      updateBalanceDisplay(latestBalance);

      if (amount > latestBalance) {
        throw new Error("Insufficient balance.");
      }

      // Check existing pending request
      const pendingQuery = query(
        collection(db, "withdrawals"),
        where("userId", "==", currentUser.uid),
        where("status", "==", "pending")
      );

      const pendingSnapshot =
        await getDocs(pendingQuery);

      if (!pendingSnapshot.empty) {
        throw new Error(
          "You already have a pending withdrawal request."
        );
      }

      // Create demo withdrawal request
      await addDoc(
        collection(db, "withdrawals"),
        {
          userId: currentUser.uid,
          amount: amount,
          upiId: upiId,
          status: "pending",
          requestedAt: serverTimestamp()
        }
      );

      message.textContent =
        "Withdrawal request submitted successfully! Status: Pending.";

      $("withdrawalForm").reset();

      // Real-time listener will update the history automatically.

    } catch (error) {
      console.error(
        "Withdrawal request error:",
        error
      );

      message.textContent =
        error.message;

    } finally {
      submitButton.disabled = false;
    }
  }
);

// ================================