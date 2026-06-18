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
    "poll_interval_seconds": 3
}

# Global State
config = {}
shared_state = {
    "status": "LOCKED",  # LOCKED, UNLOCKED
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

# Helper to parse ISO 8601 timestamps safely across any Python 3.x version
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

# Send PATCH request to Supabase to mark the usage as Overdue
def mark_session_overdue(session_id, supabase_url, supabase_anon_key):
    try:
        url = f"{supabase_url}/rest/v1/penggunaan_pc?id=eq.{session_id}"
        req = urllib.request.Request(url, method="PATCH")
        req.add_header("apikey", supabase_anon_key)
        req.add_header("Authorization", f"Bearer {supabase_anon_key}")
        req.add_header("Content-Type", "application/json")
        
        data = json.dumps({"status": "Overdue"}).encode("utf-8")
        with urllib.request.urlopen(req, data=data, timeout=5) as response:
            pass
        print(f"Session {session_id} marked as Overdue in DB.")
    except Exception as e:
        print("Error marking session overdue:", e)

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
            # Step 1: Verify pairing key / client key against the database
            verify_url = f"{supabase_url}/rest/v1/daftar_pc?no_pc=eq.{no_pc}&client_key=eq.{client_key}&limit=1"
            v_req = urllib.request.Request(verify_url)
            v_req.add_header("apikey", supabase_anon_key)
            v_req.add_header("Authorization", f"Bearer {supabase_anon_key}")
            
            with urllib.request.urlopen(v_req, timeout=5) as v_response:
                pc_info = json.loads(v_response.read().decode())
            
            if not pc_info:
                with state_lock:
                    shared_state["status"] = "LOCKED"
                    shared_state["is_connected"] = False
                    shared_state["error_message"] = "Error: Key PC tidak valid / tidak terdaftar!"
                time.sleep(5)
                continue
            
            # Step 2: Query latest session for this PC
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
                
                # Check status and remaining time
                waktu_selesai_epoch = parse_iso_timestamp(waktu_selesai_str)
                current_epoch = time.time()
                
                with state_lock:
                    shared_state["session_id"] = session_id
                    shared_state["db_status"] = db_status
                    shared_state["user_name"] = user_name
                    shared_state["tujuan"] = tujuan
                    shared_state["waktu_selesai_epoch"] = waktu_selesai_epoch
                    shared_state["is_connected"] = True
                    shared_state["error_message"] = ""
                    
                    if db_status == "Aktif":
                        if current_epoch < waktu_selesai_epoch:
                            shared_state["status"] = "UNLOCKED"
                        else:
                            # Time expired, show lock screen and update status to Overdue in DB
                            shared_state["status"] = "LOCKED"
                            threading.Thread(
                                target=mark_session_overdue, 
                                args=(session_id, supabase_url, supabase_anon_key), 
                                daemon=True
                            ).start()
                    else:
                        shared_state["status"] = "LOCKED"
            else:
                with state_lock:
                    shared_state["status"] = "LOCKED"
                    shared_state["is_connected"] = True
                    shared_state["error_message"] = ""
                    
        except Exception as e:
            with state_lock:
                shared_state["is_connected"] = False
                shared_state["error_message"] = f"Gagal menghubungkan ke database: {str(e)}"
                shared_state["status"] = "LOCKED"
        
        # Sleep checking the running flag frequently for responsive closing
        for _ in range(int(poll_interval * 10)):
            if not running:
                break
            time.sleep(0.1)

# GUI Application Setup
class BillingApp:
    def __init__(self):
        # Create Main Lock Window (Full screen)
        self.lock_window = tk.Tk()
        self.lock_window.title("Creative Corner - PC Locker")
        self.lock_window.configure(bg="#0f172a") # Slate 900
        
        # Prevent closing & make fullscreen
        self.lock_window.attributes("-fullscreen", True)
        self.lock_window.attributes("-topmost", True)
        self.lock_window.protocol("WM_DELETE_WINDOW", lambda: None)
        
        # Keep focus locked to this window to prevent alt-tab
        self.lock_window.bind("<FocusOut>", self.force_focus)
        
        # Admin Configuration Key Binding: Ctrl+Shift+C
        self.lock_window.bind("<Control-Shift-C>", self.open_admin_panel)
        
        # Build Lock Screen GUI Layout
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
        
        # Position floating window in top-right by default
        screen_w = self.lock_window.winfo_screenwidth()
        self.timer_window.geometry(f"250x110+{screen_w - 270}+30")
        
        self.setup_timer_ui()
        
        # Hide timer initially
        self.timer_window.withdraw()
        
        # Start GUI update recurring loop
        self.lock_window.after(200, self.update_loop)

    def force_focus(self, event=None):
        with state_lock:
            status = shared_state["status"]
        if status == "LOCKED":
            self.lock_window.focus_force()
            self.lock_window.attributes("-topmost", True)

    def setup_lock_ui(self):
        # Center container
        container = tk.Frame(self.lock_window, bg="#0f172a")
        container.place(relx=0.5, rely=0.5, anchor="center")
        
        # Large Sleek Logo Banner
        logo_label = tk.Label(container, text="🖥️", font=("Segoe UI Symbol", 64), bg="#0f172a", fg="#a855f7") # Purple 500
        logo_label.pack(pady=5)
        
        title_label = tk.Label(container, text="CREATIVE CORNER", font=("Segoe UI", 36, "bold"), bg="#0f172a", fg="#f8fafc")
        title_label.pack()
        
        subtitle_label = tk.Label(container, text="SISTEM BILLING STUDIO", font=("Segoe UI", 14, "bold"), bg="#0f172a", fg="#94a3b8")
        subtitle_label.pack(pady=(0, 25))
        
        # Center status card
        self.card = tk.Frame(container, bg="#1e293b", bd=2, relief="flat", padx=40, pady=25) # Slate 800
        self.card.pack(pady=10)
        
        self.pc_num_label = tk.Label(self.card, text=f"PC {config.get('no_pc', 1):02d}", font=("Consolas", 48, "bold"), bg="#1e293b", fg="#a855f7")
        self.pc_num_label.pack()
        
        self.lock_status_label = tk.Label(self.card, text="PC TERKUNCI", font=("Segoe UI", 18, "bold"), bg="#1e293b", fg="#ef4444")
        self.lock_status_label.pack(pady=5)
        
        instructions = tk.Label(self.card, text="Silakan hubungi Admin Creative Corner\nuntuk mengaktifkan PC ini.", font=("Segoe UI", 11), bg="#1e293b", fg="#cbd5e1")
        instructions.pack(pady=5)
        
        # Bottom Connection Status bar
        self.status_bar = tk.Label(self.lock_window, text="Menghubungkan ke database...", font=("Segoe UI", 10), bg="#0f172a", fg="#94a3b8", pady=10)
        self.status_bar.pack(side="bottom", fill="x")
        
        # Quiet settings indicator
        settings_tip = tk.Label(self.lock_window, text="Press Ctrl+Shift+C for settings", font=("Segoe UI", 8), bg="#0f172a", fg="#475569")
        settings_tip.pack(side="bottom", anchor="se", padx=10, pady=5)

    def setup_timer_ui(self):
        # Timer window container
        main_frame = tk.Frame(self.timer_window, bg="#18181b", highlightbackground="#a855f7", highlightthickness=2)
        main_frame.pack(fill="both", expand=True)
        
        # Header bar (grabbable / drag area)
        self.timer_header = tk.Label(main_frame, text=f"CC BILLING - PC {config.get('no_pc', 1):02d}", font=("Segoe UI", 9, "bold"), bg="#a855f7", fg="#ffffff", cursor="fleur")
        self.timer_header.pack(fill="x")
        
        # Username display
        self.timer_user = tk.Label(main_frame, text="Pengguna: -", font=("Segoe UI", 10, "bold"), bg="#18181b", fg="#f4f4f5")
        self.timer_user.pack(anchor="w", padx=12, pady=(8, 2))
        
        # Purpose display
        self.timer_purpose = tk.Label(main_frame, text="Tujuan: -", font=("Segoe UI", 8), bg="#18181b", fg="#a1a1aa")
        self.timer_purpose.pack(anchor="w", padx=12, pady=(0, 2))
        
        # Countdown time display
        self.timer_countdown = tk.Label(main_frame, text="00:00:00", font=("Consolas", 20, "bold"), bg="#18181b", fg="#22c55e") # Green 500
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

    def open_admin_panel(self, event=None):
        # Temporary disable topmost focus grab to allow input dialog to work
        self.lock_window.unbind("<FocusOut>")
        self.lock_window.attributes("-topmost", False)
        
        # Prompt admin password
        pwd = simpledialog.askstring("Admin Login", "Masukkan password admin:", show="*", parent=self.lock_window)
        
        if pwd == config.get("admin_password"):
            self.show_config_dialog()
        elif pwd is not None:
            messagebox.showerror("Error", "Password salah!", parent=self.lock_window)
            
        # Re-enable topmost focus grab
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
                    messagebox.showinfo("Sukses", "Konfigurasi berhasil disimpan! Program akan mereload koneksi.", parent=dialog)
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
            
        # Transition GUI state
        if status == "UNLOCKED" and remaining_seconds > 0:
            # Hide lock window
            if self.lock_window.winfo_viewable():
                self.lock_window.withdraw()
            
            # Update and show floating timer window
            self.timer_user.config(text=f"Pengguna: {user_name}")
            self.timer_purpose.config(text=f"Tujuan: {tujuan}")
            
            # Format time HH:MM:SS
            h = remaining_seconds // 3600
            m = (remaining_seconds % 3600) // 60
            s = remaining_seconds % 60
            time_str = f"{h:02d}:{m:02d}:{s:02d}"
            
            self.timer_countdown.config(text=time_str)
            
            # Change color to orange-red if under 5 minutes remaining
            if remaining_seconds < 300:
                self.timer_countdown.config(fg="#ef4444") # Red 500
            else:
                self.timer_countdown.config(fg="#22c55e") # Green 500
                
            if not self.timer_window.winfo_viewable():
                self.timer_window.deiconify()
                self.timer_window.attributes("-topmost", True)
        else:
            # Hide floating timer window
            if self.timer_window.winfo_viewable():
                self.timer_window.withdraw()
                
            # Show lock screen window
            if not self.lock_window.winfo_viewable():
                self.lock_window.deiconify()
                self.lock_window.attributes("-fullscreen", True)
                self.lock_window.attributes("-topmost", True)
                self.lock_window.focus_force()
                
        # Register next callback
        self.lock_window.after(200, self.update_loop)

    def run(self):
        self.lock_window.mainloop()

# Main Entrypoint
if __name__ == "__main__":
    # Load configuration
    load_config()
    
    # Start background polling thread
    poll_thread = threading.Thread(target=polling_loop, daemon=True)
    poll_thread.start()
    
    try:
        # Start GUI application
        app = BillingApp()
        app.run()
    except KeyboardInterrupt:
        pass
    finally:
        # Set running flag to false to terminate background thread cleanly
        running = False
        print("Billing Client shutting down...")
