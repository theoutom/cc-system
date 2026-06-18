import os
import sys
import json
import time
import urllib.request
import urllib.parse
import calendar
from datetime import datetime
import threading
import tkinter as tk
from tkinter import messagebox, simpledialog

# Configuration file path
CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

# Default configuration values
DEFAULT_CONFIG = {
    "supabase_url": "https://svmpggzgvmfawhjpfslj.supabase.co",
    "supabase_anon_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2bXBnZ3pndm1mYXdoanBmc2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDMzOTgsImV4cCI6MjA4ODU3OTM5OH0.XMPF-32jdpm4gjCs7yjOtkvM998Lanh-K92pf1lNgEM",
    "no_pc": 1,
    "client_key": "cc-pc1-key-secret",
    "admin_password": "creativecorner",
    "poll_interval_seconds": 3,
    "telegram_bot_token": "8802972198:AAGAogx86xwcNSFuL1mL1a9ZH3hmAAXy_So",
    "telegram_chat_id": "5919418896"
}

# Global State
config = {}
shared_state = {
    "status": "LOCKED",  # LOCKED, UNLOCKED, EXPIRED, SHUTDOWN_WAIT
    "error_message": "",
    "user_name": "",
    "tujuan": "",
    "waktu_selesai_epoch": 0,
    "session_id": None,
    "db_status": "",
    "is_connected": False
}
state_lock = threading.Lock()
running = True

# Helper to parse ISO 8601 timestamps safely
def parse_iso_timestamp(ts_str):
    try:
        if ts_str.endswith('Z'):
            ts_str = ts_str[:-1] + '+00:00'
        base_str = ts_str[:19]
        dt = datetime.strptime(base_str, "%Y-%m-%dT%H:%M:%S")
        return calendar.timegm(dt.utctimetuple())
    except Exception as e:
        print(f"Error parsing timestamp {ts_str}: {e}")
        return 0

# Load configuration from JSON
def load_config():
    global config
    if not os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "w") as f:
                json.dump(DEFAULT_CONFIG, f, indent=2)
            config = DEFAULT_CONFIG.copy()
        except Exception as e:
            print("Failed to create default config:", e)
            config = DEFAULT_CONFIG.copy()
    else:
        try:
            with open(CONFIG_PATH, "r") as f:
                loaded = json.load(f)
                config = DEFAULT_CONFIG.copy()
                config.update(loaded)
        except Exception as e:
            print("Failed to load config, using defaults:", e)
            config = DEFAULT_CONFIG.copy()

# Save configuration to JSON
def save_config(new_config):
    global config
    config.update(new_config)
    try:
        with open(CONFIG_PATH, "w") as f:
            json.dump(config, f, indent=2)
        return True
    except Exception as e:
        messagebox.showerror("Error", f"Gagal menyimpan konfigurasi: {e}")
        return False

# Send Telegram notification
def send_telegram_notification(msg):
    token = config.get("telegram_bot_token")
    chat_id = config.get("telegram_chat_id")
    if not token or not chat_id:
        return
    try:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        data = urllib.parse.urlencode({
            "chat_id": chat_id,
            "text": msg,
            "parse_mode": "Markdown"
        }).encode("utf-8")
        req = urllib.request.Request(url, data=data)
        with urllib.request.urlopen(req, timeout=5) as response:
            pass
    except Exception as e:
        print("Telegram notification failed:", e)

# Send POST request to start session
def api_start_session(nama, tujuan, durasi_jam):
    supabase_url = config.get("supabase_url")
    supabase_anon_key = config.get("supabase_anon_key")
    no_pc = config.get("no_pc", 1)
    
    start_dt = datetime.utcnow()
    # End datetime is start + duration
    # Since datetime.utcnow() is naive, we format as ISO with Z
    start_str = start_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    
    # Calculate end
    # durasi_jam is a float or int
    end_epoch = time.time() + (durasi_jam * 3600)
    end_dt = datetime.utcfromtimestamp(end_epoch)
    end_str = end_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    
    try:
        url = f"{supabase_url}/rest/v1/penggunaan_pc"
        req = urllib.request.Request(url, method="POST")
        req.add_header("apikey", supabase_anon_key)
        req.add_header("Authorization", f"Bearer {supabase_anon_key}")
        req.add_header("Content-Type", "application/json")
        req.add_header("Prefer", "return=representation")
        
        payload = {
            "nama_pengguna": nama,
            "tujuan": tujuan,
            "durasi_jam": durasi_jam,
            "waktu_mulai": start_str,
            "waktu_selesai": end_str,
            "no_pc": no_pc,
            "status": "Aktif"
        }
        
        data = json.dumps(payload).encode("utf-8")
        with urllib.request.urlopen(req, data=data, timeout=5) as response:
            res = json.loads(response.read().decode())
            if res:
                session_id = res[0].get("id")
                # Send telegram notification
                send_telegram_notification(
                    f"🖥️ *PC {no_pc} MULAI SESI*\n"
                    f"👤 Pengguna: *{nama}*\n"
                    f"🎯 Tujuan: *{tujuan}*\n"
                    f"⏳ Durasi: *{durasi_jam} Jam*\n"
                    f"🕒 Selesai: *{end_dt.strftime('%H:%M:%S UTC')}*"
                )
                return session_id, end_epoch
        return None, 0
    except Exception as e:
        print("API start session failed:", e)
        raise e

# Send PATCH request to mark the usage as Selesai / Overdue
def api_update_session_status(session_id, status):
    supabase_url = config.get("supabase_url")
    supabase_anon_key = config.get("supabase_anon_key")
    no_pc = config.get("no_pc", 1)
    
    try:
        url = f"{supabase_url}/rest/v1/penggunaan_pc?id=eq.{session_id}"
        req = urllib.request.Request(url, method="PATCH")
        req.add_header("apikey", supabase_anon_key)
        req.add_header("Authorization", f"Bearer {supabase_anon_key}")
        req.add_header("Content-Type", "application/json")
        
        payload = {"status": status}
        data = json.dumps(payload).encode("utf-8")
        with urllib.request.urlopen(req, data=data, timeout=5) as response:
            pass
        print(f"Session {session_id} updated to {status}.")
        return True
    except Exception as e:
        print(f"API update session to {status} failed:", e)
        return False

# Background Polling Thread Loop
def polling_loop():
    global running
    
    while running:
        supabase_url = config.get("supabase_url")
        supabase_anon_key = config.get("supabase_anon_key")
        no_pc = config.get("no_pc", 1)
        client_key = config.get("client_key", "")
        poll_interval = config.get("poll_interval_seconds", 3)
        
        try:
            # Step 1: Verify pairing key / client key
            verify_url = f"{supabase_url}/rest/v1/daftar_pc?no_pc=eq.{no_pc}&client_key=eq.{client_key}&limit=1"
            v_req = urllib.request.Request(verify_url)
            v_req.add_header("apikey", supabase_anon_key)
            v_req.add_header("Authorization", f"Bearer {supabase_anon_key}")
            
            with urllib.request.urlopen(v_req, timeout=5) as v_response:
                pc_info = json.loads(v_response.read().decode())
            
            if not pc_info:
                with state_lock:
                    shared_state["is_connected"] = False
                    shared_state["error_message"] = "Key PC tidak valid / tidak terdaftar!"
                    shared_state["status"] = "LOCKED"
                time.sleep(5)
                continue
            
            # Step 2: Query latest session
            url = f"{supabase_url}/rest/v1/penggunaan_pc?no_pc=eq.{no_pc}&order=created_at.desc&limit=1"
            req = urllib.request.Request(url)
            req.add_header("apikey", supabase_anon_key)
            req.add_header("Authorization", f"Bearer {supabase_anon_key}")
            
            with urllib.request.urlopen(req, timeout=5) as response:
                sessions = json.loads(response.read().decode())
            
            if sessions:
                session = sessions[0]
                session_id = session.get("id")
                db_status = session.get("status")
                waktu_selesai_str = session.get("waktu_selesai")
                user_name = session.get("nama_pengguna", "User")
                tujuan = session.get("tujuan", "Pemakaian PC")
                waktu_selesai_epoch = parse_iso_timestamp(waktu_selesai_str)
                current_epoch = time.time()
                
                with state_lock:
                    shared_state["session_id"] = session_id
                    shared_state["db_status"] = db_status
                    shared_state["is_connected"] = True
                    shared_state["error_message"] = ""
                    
                    # We only automatically override GUI state if the DB says 'Selesai' (Admin ended it)
                    # or if there is an active session we need to unlock.
                    # If local state is EXPIRED or SHUTDOWN_WAIT, we don't automatically override back to UNLOCKED/LOCKED
                    # unless a new session is started in DB or state matches.
                    local_status = shared_state["status"]
                    
                    if db_status == "Aktif":
                        if current_epoch < waktu_selesai_epoch:
                            if local_status != "EXPIRED" and local_status != "SHUTDOWN_WAIT":
                                shared_state["status"] = "UNLOCKED"
                                shared_state["user_name"] = user_name
                                shared_state["tujuan"] = tujuan
                                shared_state["waktu_selesai_epoch"] = waktu_selesai_epoch
                        else:
                            # Expired locally but still Aktif in DB
                            if local_status == "UNLOCKED":
                                shared_state["status"] = "EXPIRED"
                                shared_state["user_name"] = user_name
                                shared_state["tujuan"] = tujuan
                                shared_state["waktu_selesai_epoch"] = waktu_selesai_epoch
                    elif db_status == "Selesai":
                        if local_status == "UNLOCKED" or local_status == "EXPIRED":
                            # Session was stopped by Admin, lock PC
                            shared_state["status"] = "LOCKED"
            else:
                with state_lock:
                    if shared_state["status"] == "UNLOCKED":
                        shared_state["status"] = "LOCKED"
                    shared_state["is_connected"] = True
                    shared_state["error_message"] = ""
                    
        except Exception as e:
            with state_lock:
                shared_state["is_connected"] = False
                shared_state["error_message"] = f"Koneksi error: {str(e)}"
        
        # Sleep
        for _ in range(int(poll_interval * 10)):
            if not running:
                break
            time.sleep(0.1)

# GUI Application Setup
class BillingApp:
    def __init__(self):
        # Create Main Window (Full screen)
        self.lock_window = tk.Tk()
        self.lock_window.title("Creative Corner - PC Locker")
        self.lock_window.configure(bg="#0f172a") # Slate 900
        
        self.lock_window.attributes("-fullscreen", True)
        self.lock_window.attributes("-topmost", True)
        self.lock_window.protocol("WM_DELETE_WINDOW", lambda: None)
        
        # Prevent ALT+TAB switching
        self.lock_window.bind("<FocusOut>", self.force_focus)
        self.lock_window.bind("<Control-Shift-C>", self.open_admin_panel)
        
        # Build Lock UI containing form
        self.setup_lock_ui()
        
        # Create Borderless Floating Timer Window
        self.timer_window = tk.Toplevel(self.lock_window)
        self.timer_window.title("Timer")
        self.timer_window.configure(bg="#18181b") # Zinc 900
        self.timer_window.overrideredirect(True) # Borderless
        self.timer_window.attributes("-topmost", True)
        self.timer_window.protocol("WM_DELETE_WINDOW", lambda: None)
        
        # Floating window drag functionality
        self.timer_window.bind("<Button-1>", self.start_drag)
        self.timer_window.bind("<B1-Motion>", self.drag)
        
        # Position floating window in top-right
        screen_w = self.lock_window.winfo_screenwidth()
        self.timer_window.geometry(f"250x110+{screen_w - 270}+30")
        
        self.setup_timer_ui()
        self.timer_window.withdraw()
        
        # Keep track of local state transitions
        self.current_state = "LOCKED" # LOCKED, UNLOCKED, EXPIRED, SHUTDOWN_WAIT
        
        # Start GUI update loop
        self.lock_window.after(200, self.update_loop)

    def force_focus(self, event=None):
        if self.current_state in ["LOCKED", "EXPIRED", "SHUTDOWN_WAIT"]:
            self.lock_window.focus_force()
            self.lock_window.attributes("-topmost", True)

    def setup_lock_ui(self):
        # Master panel
        self.lock_panel = tk.Frame(self.lock_window, bg="#0f172a")
        self.lock_panel.place(relx=0.5, rely=0.5, anchor="center")
        
        # Title
        logo = tk.Label(self.lock_panel, text="🖥️", font=("Segoe UI Symbol", 56), bg="#0f172a", fg="#a855f7")
        logo.pack(pady=5)
        
        title = tk.Label(self.lock_panel, text="CREATIVE CORNER", font=("Segoe UI", 28, "bold"), bg="#0f172a", fg="#f8fafc")
        title.pack()
        
        subtitle = tk.Label(self.lock_panel, text="SISTEM BILLING PC - self service", font=("Segoe UI", 11, "bold"), bg="#0f172a", fg="#64748b")
        subtitle.pack(pady=(0, 15))
        
        # Form Card
        self.card = tk.Frame(self.lock_panel, bg="#1e293b", bd=0, padx=35, pady=25)
        self.card.pack(pady=5)
        
        self.pc_num_label = tk.Label(self.card, text=f"PC {config.get('no_pc', 1):02d}", font=("Consolas", 32, "bold"), bg="#1e293b", fg="#a855f7")
        self.pc_num_label.pack(pady=(0, 15))
        
        # Form Fields
        tk.Label(self.card, text="Nama Pengguna *", font=("Segoe UI", 10, "bold"), bg="#1e293b", fg="#94a3b8", anchor="w").pack(fill="x")
        self.name_entry = tk.Entry(self.card, font=("Segoe UI", 11), bg="#334155", fg="#ffffff", insertbackground="white", bd=0, highlightthickness=1, highlightbackground="#475569", width=30)
        self.name_entry.pack(pady=(2, 10))
        
        tk.Label(self.card, text="Tujuan / Keperluan *", font=("Segoe UI", 10, "bold"), bg="#1e293b", fg="#94a3b8", anchor="w").pack(fill="x")
        self.purpose_entry = tk.Entry(self.card, font=("Segoe UI", 11), bg="#334155", fg="#ffffff", insertbackground="white", bd=0, highlightthickness=1, highlightbackground="#475569", width=30)
        self.purpose_entry.pack(pady=(2, 10))
        
        tk.Label(self.card, text="Durasi Pemakaian *", font=("Segoe UI", 10, "bold"), bg="#1e293b", fg="#94a3b8", anchor="w").pack(fill="x")
        
        # OptionMenu for Hours
        self.duration_val = tk.StringVar(self.lock_window)
        self.duration_val.set("1 Jam")
        self.duration_options = ["1 Jam", "2 Jam", "3 Jam", "4 Jam", "5 Jam", "6 Jam"]
        self.duration_menu = tk.OptionMenu(self.card, self.duration_val, *self.duration_options)
        self.duration_menu.config(font=("Segoe UI", 10), bg="#334155", fg="#ffffff", activebackground="#475569", activeforeground="#ffffff", bd=0, highlightthickness=1, highlightbackground="#475569", width=27)
        self.duration_menu["menu"].config(bg="#1e293b", fg="#ffffff", font=("Segoe UI", 10))
        self.duration_menu.pack(pady=(2, 15))
        
        # Submit Button
        self.start_btn = tk.Button(self.card, text="Mulai Sesi Sekarang", command=self.handle_client_start, font=("Segoe UI", 11, "bold"), bg="#a855f7", fg="#ffffff", activebackground="#c084fc", activeforeground="#ffffff", bd=0, pady=6)
        self.start_btn.pack(fill="x", pady=5)
        
        # Connection status bar
        self.status_bar = tk.Label(self.lock_window, text="Menghubungkan ke database...", font=("Segoe UI", 10), bg="#0f172a", fg="#94a3b8", pady=10)
        self.status_bar.pack(side="bottom", fill="x")
        
        settings_tip = tk.Label(self.lock_window, text="Tekan Ctrl+Shift+C untuk pengaturan", font=("Segoe UI", 8), bg="#0f172a", fg="#475569")
        settings_tip.pack(side="bottom", anchor="se", padx=10, pady=5)

    def setup_timer_ui(self):
        main_frame = tk.Frame(self.timer_window, bg="#18181b", highlightbackground="#a855f7", highlightthickness=2)
        main_frame.pack(fill="both", expand=True)
        
        self.timer_header = tk.Label(main_frame, text=f"CC BILLING - PC {config.get('no_pc', 1):02d}", font=("Segoe UI", 9, "bold"), bg="#a855f7", fg="#ffffff", cursor="fleur")
        self.timer_header.pack(fill="x")
        
        self.timer_user = tk.Label(main_frame, text="Pengguna: -", font=("Segoe UI", 10, "bold"), bg="#18181b", fg="#f4f4f5")
        self.timer_user.pack(anchor="w", padx=12, pady=(8, 2))
        
        self.timer_purpose = tk.Label(main_frame, text="Tujuan: -", font=("Segoe UI", 8), bg="#18181b", fg="#a1a1aa")
        self.timer_purpose.pack(anchor="w", padx=12, pady=(0, 2))
        
        self.timer_countdown = tk.Label(main_frame, text="00:00:00", font=("Consolas", 20, "bold"), bg="#18181b", fg="#22c55e")
        self.timer_countdown.pack(pady=(2, 6))

    # Drag floating window methods
    def start_drag(self, event):
        self.timer_window.x = event.x
        self.timer_window.y = event.y

    def drag(self, event):
        deltax = event.x - self.timer_window.x
        deltay = event.y - self.timer_window.y
        x = self.timer_window.winfo_x() + deltax
        y = self.timer_window.winfo_y() + deltay
        self.timer_window.geometry(f"+{x}+{y}")

    # Handle Mulai Sesi from lock screen
    def handle_client_start(self):
        nama = self.name_entry.get().strip()
        tujuan = self.purpose_entry.get().strip()
        durasi_str = self.duration_val.get()
        
        if not nama or not tujuan:
            messagebox.showerror("Error", "Nama Pengguna dan Keperluan wajib diisi!", parent=self.lock_window)
            return
            
        try:
            durasi_jam = int(durasi_str.split(" ")[0])
        except Exception:
            durasi_jam = 1
            
        self.start_btn.config(state="disabled", text="Memproses...")
        
        def run_start():
            try:
                session_id, end_epoch = api_start_session(nama, tujuan, durasi_jam)
                if session_id:
                    with state_lock:
                        shared_state["session_id"] = session_id
                        shared_state["user_name"] = nama
                        shared_state["tujuan"] = tujuan
                        shared_state["waktu_selesai_epoch"] = end_epoch
                        shared_state["status"] = "UNLOCKED"
                else:
                    raise Exception("Gagal membuat sesi baru")
            except Exception as e:
                messagebox.showerror("Error", f"Gagal memulai: {e}", parent=self.lock_window)
            finally:
                self.start_btn.config(state="normal", text="Mulai Sesi Sekarang")
                
        threading.Thread(target=run_start, daemon=True).start()

    # Handle Sesi Perpanjangan dari layar expired
    def handle_extend_session(self, extend_purpose_entry, extend_dur_val, extend_submit_btn, extend_frame):
        tujuan = extend_purpose_entry.get().strip()
        dur_str = extend_dur_val.get()
        
        if not tujuan:
            messagebox.showerror("Error", "Keperluan perpanjangan wajib diisi!", parent=self.lock_window)
            return
            
        try:
            durasi_jam = int(dur_str.split(" ")[0])
        except Exception:
            durasi_jam = 1
            
        extend_submit_btn.config(state="disabled", text="Memproses...")
        
        with state_lock:
            prev_session_id = shared_state["session_id"]
            nama = shared_state["user_name"]
            
        def run_extend():
            try:
                # 1. Mark previous session as completed
                if prev_session_id:
                    api_update_session_status(prev_session_id, "Selesai")
                
                # 2. Start a new session
                session_id, end_epoch = api_start_session(nama, tujuan, durasi_jam)
                if session_id:
                    with state_lock:
                        shared_state["session_id"] = session_id
                        shared_state["tujuan"] = tujuan
                        shared_state["waktu_selesai_epoch"] = end_epoch
                        shared_state["status"] = "UNLOCKED"
                    
                    # Remove the extend frame
                    self.lock_window.after(0, extend_frame.destroy)
                else:
                    raise Exception("Gagal memperpanjang sesi")
            except Exception as e:
                messagebox.showerror("Error", f"Gagal perpanjang: {e}", parent=self.lock_window)
                self.lock_window.after(0, lambda: extend_submit_btn.config(state="normal", text="Perpanjang Sesi"))
                
        threading.Thread(target=run_extend, daemon=True).start()

    # Handle Selesai / Close PC
    def handle_session_finish(self, optional_frame_to_destroy=None):
        with state_lock:
            session_id = shared_state["session_id"]
            nama = shared_state["user_name"]
            no_pc = config.get("no_pc", 1)
            
        def run_stop():
            if session_id:
                api_update_session_status(session_id, "Selesai")
            
            # Send notification to Telegram
            send_telegram_notification(
                f"⏹️ *PC {no_pc} SELESAI*\n"
                f"👤 Pengguna: *{nama}*\n"
                f"✅ PC siap dimatikan / dibersihkan."
            )
            
            # Clean fields
            self.lock_window.after(0, self.reset_form_fields)
            
            # Transition to shutdown screen
            with state_lock:
                shared_state["status"] = "SHUTDOWN_WAIT"
                
            if optional_frame_to_destroy:
                self.lock_window.after(0, optional_frame_to_destroy.destroy)
                
        threading.Thread(target=run_stop, daemon=True).start()

    def reset_form_fields(self):
        self.name_entry.delete(0, tk.END)
        self.purpose_entry.delete(0, tk.END)
        self.duration_val.set("1 Jam")

    # Command to shut down PC
    def shutdown_computer(self):
        confirm = messagebox.askyesno("Shutdown", "Matikan komputer sekarang?", parent=self.lock_window)
        if confirm:
            send_telegram_notification(f"🔌 *PC {config.get('no_pc', 1)} SHUTDOWN*")
            if sys.platform.startswith('win'):
                os.system("shutdown /s /t 2")
            else:
                os.system("shutdown -h now")

    def open_admin_panel(self, event=None):
        self.lock_window.unbind("<FocusOut>")
        self.lock_window.attributes("-topmost", False)
        
        pwd = simpledialog.askstring("Admin Login", "Masukkan password admin:", show="*", parent=self.lock_window)
        if pwd == config.get("admin_password"):
            self.show_config_dialog()
        elif pwd is not None:
            messagebox.showerror("Error", "Password salah!", parent=self.lock_window)
            
        self.lock_window.bind("<FocusOut>", self.force_focus)
        self.lock_window.attributes("-topmost", True)
        self.lock_window.focus_force()

    def show_config_dialog(self):
        dialog = tk.Toplevel(self.lock_window)
        dialog.title("Konfigurasi Client")
        dialog.geometry("400x360")
        dialog.configure(bg="#1e293b")
        dialog.transient(self.lock_window)
        dialog.grab_set()
        dialog.attributes("-topmost", True)
        
        tk.Label(dialog, text="KONFIGURASI BILLING PC", font=("Segoe UI", 14, "bold"), bg="#1e293b", fg="#ffffff").pack(pady=15)
        
        form_frame = tk.Frame(dialog, bg="#1e293b")
        form_frame.pack(padx=20, fill="x")
        
        tk.Label(form_frame, text="Nomor PC:", bg="#1e293b", fg="#cbd5e1", anchor="w").grid(row=0, column=0, sticky="we", pady=5)
        pc_entry = tk.Entry(form_frame, bg="#334155", fg="#ffffff", insertbackground="white", bd=0, highlightthickness=1, highlightbackground="#475569")
        pc_entry.insert(0, str(config.get("no_pc", 1)))
        pc_entry.grid(row=0, column=1, sticky="we", pady=5, padx=10)
        
        tk.Label(form_frame, text="Client Key (Pairing):", bg="#1e293b", fg="#cbd5e1", anchor="w").grid(row=1, column=0, sticky="we", pady=5)
        key_secret_entry = tk.Entry(form_frame, bg="#334155", fg="#ffffff", insertbackground="white", bd=0, highlightthickness=1, highlightbackground="#475569")
        key_secret_entry.insert(0, config.get("client_key", ""))
        key_secret_entry.grid(row=1, column=1, sticky="we", pady=5, padx=10)
        
        tk.Label(form_frame, text="Supabase URL:", bg="#1e293b", fg="#cbd5e1", anchor="w").grid(row=2, column=0, sticky="we", pady=5)
        url_entry = tk.Entry(form_frame, bg="#334155", fg="#ffffff", insertbackground="white", bd=0, highlightthickness=1, highlightbackground="#475569")
        url_entry.insert(0, config.get("supabase_url", ""))
        url_entry.grid(row=2, column=1, sticky="we", pady=5, padx=10)
        
        tk.Label(form_frame, text="Anon Key:", bg="#1e293b", fg="#cbd5e1", anchor="w").grid(row=3, column=0, sticky="we", pady=5)
        key_entry = tk.Entry(form_frame, bg="#334155", fg="#ffffff", insertbackground="white", bd=0, highlightthickness=1, highlightbackground="#475569")
        key_entry.insert(0, config.get("supabase_anon_key", ""))
        key_entry.grid(row=3, column=1, sticky="we", pady=5, padx=10)
        
        tk.Label(form_frame, text="Admin Password:", bg="#1e293b", fg="#cbd5e1", anchor="w").grid(row=4, column=0, sticky="we", pady=5)
        pass_entry = tk.Entry(form_frame, bg="#334155", fg="#ffffff", insertbackground="white", bd=0, highlightthickness=1, highlightbackground="#475569", show="*")
        pass_entry.insert(0, config.get("admin_password", ""))
        pass_entry.grid(row=4, column=1, sticky="we", pady=5, padx=10)
        
        form_frame.columnconfigure(1, weight=1)
        
        def save_action():
            try:
                new_pc = int(pc_entry.get())
                new_client_key = key_secret_entry.get().strip()
                new_url = url_entry.get().strip()
                new_key = key_entry.get().strip()
                new_pass = pass_entry.get()
                
                if not new_url or not new_key or not new_pass or not new_client_key:
                    messagebox.showerror("Error", "Semua field harus diisi!", parent=dialog)
                    return
                
                new_conf = {
                    "no_pc": new_pc,
                    "client_key": new_client_key,
                    "supabase_url": new_url,
                    "supabase_anon_key": new_key,
                    "admin_password": new_pass
                }
                
                if save_config(new_conf):
                    self.pc_num_label.config(text=f"PC {new_pc:02d}")
                    self.timer_header.config(text=f"CC BILLING - PC {new_pc:02d}")
                    messagebox.showinfo("Sukses", "Konfigurasi disimpan! Mereload koneksi.", parent=dialog)
                    dialog.destroy()
            except ValueError:
                messagebox.showerror("Error", "Nomor PC harus berupa angka!", parent=dialog)
        
        def close_action():
            dialog.destroy()
            
        btn_frame = tk.Frame(dialog, bg="#1e293b")
        btn_frame.pack(pady=20)
        
        tk.Button(btn_frame, text="Simpan", command=save_action, bg="#a855f7", fg="#ffffff", activebackground="#c084fc", activeforeground="#ffffff", font=("Segoe UI", 10, "bold"), padx=15, bd=0).pack(side="left", padx=10)
        tk.Button(btn_frame, text="Batal", command=close_action, bg="#475569", fg="#cbd5e1", activebackground="#64748b", activeforeground="#cbd5e1", font=("Segoe UI", 10), padx=15, bd=0).pack(side="left", padx=10)

    # Main thread GUI update loop running every 200ms
    def update_loop(self):
        with state_lock:
            status = shared_state["status"]
            is_connected = shared_state["is_connected"]
            error_msg = shared_state["error_message"]
            user_name = shared_state["user_name"]
            tujuan = shared_state["tujuan"]
            waktu_selesai_epoch = shared_state["waktu_selesai_epoch"]
        
        # Calculate time remaining
        current_epoch = time.time()
        remaining_seconds = int(waktu_selesai_epoch - current_epoch)
        if remaining_seconds < 0:
            remaining_seconds = 0
            
        # Update connection status indicator bar
        if error_msg:
            self.status_bar.config(text=f"⚠️ {error_msg}", fg="#f59e0b", bg="#1e1b4b")
        elif is_connected:
            self.status_bar.config(text="🟢 Terhubung ke database Supabase. Sesi dipantau real-time.", fg="#10b981", bg="#0f172a")
        else:
            self.status_bar.config(text="🟡 Menghubungkan ke database...", fg="#94a3b8", bg="#0f172a")
            
        # Handle state transitions in the GUI
        if status == "UNLOCKED" and remaining_seconds > 0:
            self.current_state = "UNLOCKED"
            # Hide lock window
            if self.lock_window.winfo_viewable():
                self.lock_window.withdraw()
            
            # Show floating timer window
            self.timer_user.config(text=f"Pengguna: {user_name}")
            self.timer_purpose.config(text=f"Tujuan: {tujuan}")
            
            h = remaining_seconds // 3600
            m = (remaining_seconds % 3600) // 60
            s = remaining_seconds % 60
            self.timer_countdown.config(text=f"{h:02d}:{m:02d}:{s:02d}")
            
            if remaining_seconds < 300:
                self.timer_countdown.config(fg="#ef4444")
            else:
                self.timer_countdown.config(fg="#22c55e")
                
            if not self.timer_window.winfo_viewable():
                self.timer_window.deiconify()
                self.timer_window.attributes("-topmost", True)
                
        elif status == "EXPIRED":
            # Transitioning from active session to expired prompt
            if self.current_state != "EXPIRED":
                self.current_state = "EXPIRED"
                if self.timer_window.winfo_viewable():
                    self.timer_window.withdraw()
                self.show_expired_overlay()
                
        elif status == "SHUTDOWN_WAIT":
            # Transitioning to shutdown wait screen
            if self.current_state != "SHUTDOWN_WAIT":
                self.current_state = "SHUTDOWN_WAIT"
                if self.timer_window.winfo_viewable():
                    self.timer_window.withdraw()
                self.show_shutdown_overlay()
                
        else: # LOCKED
            self.current_state = "LOCKED"
            # Hide floating timer window
            if self.timer_window.winfo_viewable():
                self.timer_window.withdraw()
                
            # Show lock screen panel
            self.lock_panel.pack()
            if not self.lock_window.winfo_viewable():
                self.lock_window.deiconify()
                self.lock_window.attributes("-fullscreen", True)
                self.lock_window.attributes("-topmost", True)
                self.lock_window.focus_force()
                
        # Register next callback
        self.lock_window.after(200, self.update_loop)

    # Expired Choice overlay
    def show_expired_overlay(self):
        # Hide default login panel
        self.lock_panel.pack_forget()
        
        # Show lock window
        self.lock_window.deiconify()
        self.lock_window.attributes("-fullscreen", True)
        self.lock_window.attributes("-topmost", True)
        self.lock_window.focus_force()
        
        # Frame
        exp_frame = tk.Frame(self.lock_window, bg="#0f172a")
        exp_frame.place(relx=0.5, rely=0.5, anchor="center")
        
        tk.Label(exp_frame, text="⏰", font=("Segoe UI Symbol", 64), bg="#0f172a", fg="#ef4444").pack(pady=5)
        tk.Label(exp_frame, text="WAKTU SELESAI!", font=("Segoe UI", 28, "bold"), bg="#0f172a", fg="#ef4444").pack()
        
        with state_lock:
            nama = shared_state["user_name"]
        
        tk.Label(exp_frame, text=f"Halo {nama}, waktu sewa PC Anda telah habis.\nApakah Anda ingin memperpanjang waktu?", font=("Segoe UI", 12), bg="#0f172a", fg="#cbd5e1").pack(pady=15)
        
        # Prompt frame
        card = tk.Frame(exp_frame, bg="#1e293b", padx=30, pady=20)
        card.pack(pady=5)
        
        # Extended purpose entry
        tk.Label(card, text="Keperluan Perpanjangan *", font=("Segoe UI", 10, "bold"), bg="#1e293b", fg="#94a3b8", anchor="w").pack(fill="x")
        ext_purpose = tk.Entry(card, font=("Segoe UI", 11), bg="#334155", fg="#ffffff", insertbackground="white", bd=0, highlightthickness=1, highlightbackground="#475569", width=30)
        ext_purpose.pack(pady=(2, 10))
        
        # Extended duration OptionMenu
        ext_dur_val = tk.StringVar(self.lock_window)
        ext_dur_val.set("1 Jam")
        ext_dur_menu = tk.OptionMenu(card, ext_dur_val, *self.duration_options)
        ext_dur_menu.config(font=("Segoe UI", 10), bg="#334155", fg="#ffffff", activebackground="#475569", activeforeground="#ffffff", bd=0, highlightthickness=1, highlightbackground="#475569", width=27)
        ext_dur_menu["menu"].config(bg="#1e293b", fg="#ffffff", font=("Segoe UI", 10))
        ext_dur_menu.pack(pady=(2, 15))
        
        btn_frame = tk.Frame(card, bg="#1e293b")
        btn_frame.pack(fill="x", pady=5)
        
        submit_btn = tk.Button(btn_frame, text="Ya, Perpanjang", bg="#22c55e", fg="#ffffff", font=("Segoe UI", 10, "bold"), activebackground="#4ade80", activeforeground="#ffffff", bd=0, pady=6)
        submit_btn.config(command=lambda: self.handle_extend_session(ext_purpose, ext_dur_val, submit_btn, exp_frame))
        submit_btn.pack(side="left", fill="x", expand=True, padx=(0, 5))
        
        stop_btn = tk.Button(btn_frame, text="Tidak, Selesai", bg="#ef4444", fg="#ffffff", font=("Segoe UI", 10, "bold"), activebackground="#f87171", activeforeground="#ffffff", bd=0, pady=6)
        stop_btn.config(command=lambda: self.handle_session_finish(exp_frame))
        stop_btn.pack(side="right", fill="x", expand=True, padx=(5, 0))

    # Shutdown overlay display
    def show_shutdown_overlay(self):
        # Hide default login panel
        self.lock_panel.pack_forget()
        
        self.lock_window.deiconify()
        self.lock_window.attributes("-fullscreen", True)
        self.lock_window.attributes("-topmost", True)
        self.lock_window.focus_force()
        
        shut_frame = tk.Frame(self.lock_window, bg="#0f172a")
        shut_frame.place(relx=0.5, rely=0.5, anchor="center")
        
        tk.Label(shut_frame, text="🔌", font=("Segoe UI Symbol", 64), bg="#0f172a", fg="#ef4444").pack(pady=5)
        tk.Label(shut_frame, text="SESI BERAKHIR", font=("Segoe UI", 32, "bold"), bg="#0f172a", fg="#f8fafc").pack()
        
        instructions = tk.Label(shut_frame, text="Terima kasih telah menggunakan studio Creative Corner!\nSilakan simpan semua pekerjaan Anda, tutup aplikasi,\nkemudian matikan PC dengan menekan tombol di bawah ini.", font=("Segoe UI", 12), bg="#0f172a", fg="#94a3b8")
        instructions.pack(pady=20)
        
        card = tk.Frame(shut_frame, bg="#1e293b", padx=40, pady=25)
        card.pack(pady=10)
        
        shutdown_btn = tk.Button(card, text="Matikan PC (Shutdown)", command=self.shutdown_computer, font=("Segoe UI", 12, "bold"), bg="#ef4444", fg="#ffffff", activebackground="#f87171", activeforeground="#ffffff", bd=0, padx=25, pady=8)
        shutdown_btn.pack()
        
        back_to_login_btn = tk.Button(shut_frame, text="Kembali ke Layar Log In Utama", command=lambda: self.restart_to_locked(shut_frame), font=("Segoe UI", 9), bg="#0f172a", fg="#475569", activebackground="#0f172a", activeforeground="#94a3b8", bd=0)
        back_to_login_btn.pack(pady=30)

    # Restart PC state manually from shutdown view back to lockscreen
    def restart_to_locked(self, frame_to_destroy):
        frame_to_destroy.destroy()
        with state_lock:
            shared_state["status"] = "LOCKED"

    def run(self):
        self.lock_window.mainloop()

# Main Entrypoint
if __name__ == "__main__":
    load_config()
    
    # Start background polling loop
    poll_thread = threading.Thread(target=polling_loop, daemon=True)
    poll_thread.start()
    
    try:
        app = BillingApp()
        app.run()
    except KeyboardInterrupt:
        pass
    finally:
        running = False
        print("Billing Client shutting down...")
