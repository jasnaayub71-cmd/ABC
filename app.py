import os
import secrets
import sqlite3
from functools import wraps

from flask import (Flask, abort, flash, g, redirect, render_template,
                   request, session, url_for)
from jinja2 import DictLoader
from werkzeug.security import check_password_hash, generate_password_hash

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, "results.db")

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "change-this-secret-in-production")
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")
INSTITUTE_NAME = os.environ.get("INSTITUTE_NAME", "Your Institute Name")

# ------------------------------------------------------------------ database
SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('examiner','student'))
);
CREATE TABLE IF NOT EXISTS students(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  roll_no TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  course TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS marks(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam TEXT NOT NULL,
  subject TEXT NOT NULL,
  marks REAL NOT NULL,
  max_marks REAL NOT NULL DEFAULT 100
);
"""


def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db


@app.teardown_appcontext
def close_db(_):
    conn = g.pop("db", None)
    if conn:
        conn.close()


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
    if not conn.execute("SELECT 1 FROM users WHERE role='examiner'").fetchone():
        pw = os.environ.get("EXAMINER_PASSWORD", "examiner123")
        conn.execute("INSERT INTO users(username,password_hash,role) VALUES(?,?,?)",
                     ("examiner", generate_password_hash(pw), "examiner"))
        print("Created default examiner login -> username: examiner  password:", pw)
        print("CHANGE THIS PASSWORD after first login.")
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------- auth
def login_required(role):
    def deco(fn):
        @wraps(fn)
        def wrapper(*a, **kw):
            if session.get("role") != role:
                flash("Please log in to continue.", "error")
                return redirect(url_for("login"))
            return fn(*a, **kw)
        return wrapper
    return deco


def csrf_token():
    if "csrf" not in session:
        session["csrf"] = secrets.token_hex(16)
    return session["csrf"]


@app.before_request
def csrf_protect():
    if request.method == "POST":
        if request.form.get("csrf") != session.get("csrf"):
            abort(400, "Invalid form token. Reload the page and try again.")


app.jinja_env.globals["csrf_token"] = csrf_token
app.jinja_env.globals["institute"] = INSTITUTE_NAME


@app.route("/", methods=["GET", "POST"])
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        u = request.form.get("username", "").strip()
        p = request.form.get("password", "")
        row = db().execute("SELECT * FROM users WHERE username=?", (u,)).fetchone()
        if row and check_password_hash(row["password_hash"], p):
            session.clear()
            session["uid"], session["role"] = row["id"], row["role"]
            session["username"] = row["username"]
            return redirect(url_for("examiner_home" if row["role"] == "examiner"
                                    else "student_home"))
        flash("Invalid username or password.", "error")
    return render_template("login.html")


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


# ------------------------------------------------------------------ examiner
@app.route("/examiner")
@login_required("examiner")
def examiner_home():
    q = request.args.get("q", "").strip()
    sql = ("SELECT s.*, u.username, (SELECT COUNT(*) FROM marks m WHERE m.student_id=s.id) AS n "
           "FROM students s JOIN users u ON u.id=s.user_id ")
    args = ()
    if q:
        sql += "WHERE s.name LIKE ? OR s.roll_no LIKE ? "
        args = (f"%{q}%", f"%{q}%")
    rows = db().execute(sql + "ORDER BY s.roll_no", args).fetchall()
    return render_template("examiner_home.html", students=rows, q=q)


@app.route("/examiner/student/new", methods=["GET", "POST"])
@login_required("examiner")
def student_new():
    if request.method == "POST":
        f = request.form
        roll, name, course = f["roll_no"].strip(), f["name"].strip(), f.get("course", "").strip()
        user, pw = f["username"].strip(), f["password"]
        if not (roll and name and user and len(pw) >= 6):
            flash("Roll no, name, username are required; password needs 6+ characters.", "error")
        else:
            try:
                c = db()
                cur = c.execute("INSERT INTO users(username,password_hash,role) VALUES(?,?,'student')",
                                (user, generate_password_hash(pw)))
                c.execute("INSERT INTO students(user_id,roll_no,name,course) VALUES(?,?,?,?)",
                          (cur.lastrowid, roll, name, course))
                c.commit()
                flash("Student added.", "ok")
                return redirect(url_for("examiner_home"))
            except sqlite3.IntegrityError:
                db().rollback()
                flash("Username or roll number already exists.", "error")
    return render_template("student_form.html", s=None)


def get_student(sid):
    s = db().execute("SELECT s.*, u.username FROM students s JOIN users u ON u.id=s.user_id "
                     "WHERE s.id=?", (sid,)).fetchone()
    if not s:
        abort(404)
    return s


@app.route("/examiner/student/<int:sid>/edit", methods=["GET", "POST"])
@login_required("examiner")
def student_edit(sid):
    s = get_student(sid)
    if request.method == "POST":
        f = request.form
        try:
            c = db()
            c.execute("UPDATE students SET roll_no=?, name=?, course=? WHERE id=?",
                      (f["roll_no"].strip(), f["name"].strip(), f.get("course", "").strip(), sid))
            c.execute("UPDATE users SET username=? WHERE id=?", (f["username"].strip(), s["user_id"]))
            if f.get("password"):
                if len(f["password"]) < 6:
                    raise ValueError
                c.execute("UPDATE users SET password_hash=? WHERE id=?",
                          (generate_password_hash(f["password"]), s["user_id"]))
            c.commit()
            flash("Student updated.", "ok")
            return redirect(url_for("examiner_home"))
        except sqlite3.IntegrityError:
            db().rollback()
            flash("Username or roll number already exists.", "error")
        except ValueError:
            db().rollback()
            flash("New password must be 6+ characters.", "error")
    return render_template("student_form.html", s=s)


@app.route("/examiner/student/<int:sid>/delete", methods=["POST"])
@login_required("examiner")
def student_delete(sid):
    s = get_student(sid)
    db().execute("DELETE FROM users WHERE id=?", (s["user_id"],))  # cascades
    db().commit()
    flash("Student deleted.", "ok")
    return redirect(url_for("examiner_home"))


@app.route("/examiner/student/<int:sid>/marks", methods=["GET", "POST"])
@login_required("examiner")
def marks_page(sid):
    s = get_student(sid)
    if request.method == "POST":
        f = request.form
        action = f.get("action")
        c = db()
        try:
            if action == "add":
                c.execute("INSERT INTO marks(student_id,exam,subject,marks,max_marks) VALUES(?,?,?,?,?)",
                          (sid, f["exam"].strip(), f["subject"].strip(),
                           float(f["marks"]), float(f["max_marks"])))
            elif action == "update":
                c.execute("UPDATE marks SET exam=?, subject=?, marks=?, max_marks=? "
                          "WHERE id=? AND student_id=?",
                          (f["exam"].strip(), f["subject"].strip(), float(f["marks"]),
                           float(f["max_marks"]), int(f["mark_id"]), sid))
            elif action == "delete":
                c.execute("DELETE FROM marks WHERE id=? AND student_id=?", (int(f["mark_id"]), sid))
            if action in ("add", "update") and float(f["marks"]) > float(f["max_marks"]):
                c.rollback()
                flash("Marks cannot exceed maximum marks.", "error")
            else:
                c.commit()
                flash("Saved.", "ok")
        except (ValueError, KeyError):
            c.rollback()
            flash("Please enter valid numbers for marks.", "error")
        return redirect(url_for("marks_page", sid=sid))
    rows = db().execute("SELECT * FROM marks WHERE student_id=? ORDER BY exam, subject", (sid,)).fetchall()
    return render_template("marks.html", s=s, marks=rows)


# ------------------------------------------------------------------- student
@app.route("/student")
@login_required("student")
def student_home():
    s = db().execute("SELECT * FROM students WHERE user_id=?", (session["uid"],)).fetchone()
    if not s:
        abort(404)
    rows = db().execute("SELECT * FROM marks WHERE student_id=? ORDER BY exam, subject", (s["id"],)).fetchall()
    exams = {}
    for m in rows:
        exams.setdefault(m["exam"], []).append(m)
    summary = {}
    for e, ms in exams.items():
        got, mx = sum(x["marks"] for x in ms), sum(x["max_marks"] for x in ms)
        summary[e] = (got, mx, round(got * 100 / mx, 2) if mx else 0)
    return render_template("student_home.html", s=s, exams=exams, summary=summary)


# ----------------------------------------------------------------- templates
BASE_HTML = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{% block title %}Results{% endblock %} - {{ institute }}</title>
<style>
:root{--bg:#f4f6fb;--card:#fff;--ink:#1b2333;--mut:#667085;--pri:#2b50d9;--line:#e3e7ef;--bad:#c62828;--ok:#1b7f3b}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--ink)}
header{background:var(--pri);color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
header h1{font-size:18px;margin:0}main{max-width:960px;margin:24px auto;padding:0 16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;margin-bottom:20px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:9px 8px;border-bottom:1px solid var(--line);font-size:14px}
th{color:var(--mut);font-weight:600}
input,select{padding:9px 10px;border:1px solid var(--line);border-radius:8px;font-size:14px;width:100%}
label{display:block;font-size:13px;color:var(--mut);margin:10px 0 4px}
.btn{display:inline-block;background:var(--pri);color:#fff;border:0;border-radius:8px;padding:9px 14px;font-size:14px;cursor:pointer;text-decoration:none}
.btn.sec{background:#fff;color:var(--pri);border:1px solid var(--pri)}.btn.red{background:var(--bad)}
.btn.sm{padding:5px 10px;font-size:13px}
.flash{padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:14px}
.flash.error{background:#fdecea;color:var(--bad)}.flash.ok{background:#e6f4ea;color:var(--ok)}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:end}.row>*{flex:1;min-width:110px}
.row .fit{flex:0 0 auto}form.inline{display:inline}
.pill{background:#eef2ff;color:var(--pri);padding:3px 10px;border-radius:99px;font-size:13px}
@media print{header,.noprint{display:none}body{background:#fff}.card{border:0}}
</style></head><body>
<header><h1>{{ institute }} &middot; Result Portal</h1>
{% if session.role %}<span>{{ session.username }} ({{ session.role }})
<form class="inline" method="post" action="{{ url_for('logout') }}">
<input type="hidden" name="csrf" value="{{ csrf_token() }}"><button class="btn sec sm">Logout</button></form></span>{% endif %}
</header><main>
{% for cat,msg in get_flashed_messages(with_categories=true) %}<div class="flash {{cat}}">{{ msg }}</div>{% endfor %}
{% block body %}{% endblock %}</main></body></html>"""

LOGIN_HTML = """{% extends 'base.html' %}{% block title %}Login{% endblock %}{% block body %}
<div class="card" style="max-width:380px;margin:60px auto">
<h2 style="margin-top:0">Login</h2>
<form method="post"><input type="hidden" name="csrf" value="{{ csrf_token() }}">
<label>Username</label><input name="username" autocomplete="username" required autofocus>
<label>Password</label><input name="password" type="password" autocomplete="current-password" required>
<p><button class="btn" style="width:100%">Sign in</button></p></form>
<p style="color:var(--mut);font-size:13px">Examiners and students sign in here. You'll be taken to the right page automatically.</p>
</div>{% endblock %}"""

EXAMINER_HOME_HTML = """{% extends 'base.html' %}{% block title %}Examiner{% endblock %}{% block body %}
<div class="card"><div class="row"><h2 style="margin:0;flex:2">Students</h2>
<form class="fit" method="get"><input name="q" value="{{ q }}" placeholder="Search name / roll no"></form>
<a class="btn fit" href="{{ url_for('student_new') }}">+ Add student</a></div>
<table style="margin-top:14px"><tr><th>Roll no</th><th>Name</th><th>Course</th><th>Username</th><th>Entries</th><th></th></tr>
{% for s in students %}<tr><td>{{ s.roll_no }}</td><td>{{ s.name }}</td><td>{{ s.course }}</td><td>{{ s.username }}</td>
<td><span class="pill">{{ s.n }}</span></td><td>
<a class="btn sm" href="{{ url_for('marks_page', sid=s.id) }}">Marks</a>
<a class="btn sm sec" href="{{ url_for('student_edit', sid=s.id) }}">Edit</a>
<form class="inline" method="post" action="{{ url_for('student_delete', sid=sid if sid is defined else s.id) }}" onsubmit="return confirm('Delete this student and all marks?')">
<input type="hidden" name="csrf" value="{{ csrf_token() }}"><button class="btn sm red">Delete</button></form></td></tr>
{% else %}<tr><td colspan="6" style="color:var(--mut)">No students yet.</td></tr>{% endfor %}</table></div>{% endblock %}"""

STUDENT_FORM_HTML = """{% extends 'base.html' %}{% block title %}Student{% endblock %}{% block body %}
<div class="card" style="max-width:520px"><h2 style="margin-top:0">{{ 'Edit' if s else 'Add' }} student</h2>
<form method="post"><input type="hidden" name="csrf" value="{{ csrf_token() }}">
<label>Roll number</label><input name="roll_no" value="{{ s.roll_no if s }}" required>
<label>Full name</label><input name="name" value="{{ s.name if s }}" required>
<label>Course / class</label><input name="course" value="{{ s.course if s }}">
<label>Login username</label><input name="username" value="{{ s.username if s }}" required>
<label>{{ 'New password (leave blank to keep)' if s else 'Password (min 6 chars)' }}</label>
<input name="password" type="text" {{ '' if s else 'required' }}>
<p><button class="btn">Save</button> <a class="btn sec" href="{{ url_for('examiner_home') }}">Cancel</a></p></form></div>{% endblock %}"""

MARKS_HTML = """{% extends 'base.html' %}{% block title %}Marks{% endblock %}{% block body %}
<p><a href="{{ url_for('examiner_home') }}">&larr; All students</a></p>
<div class="card"><h2 style="margin-top:0">{{ s.name }} <span class="pill">{{ s.roll_no }}</span></h2>
<table><tr><th>Exam</th><th>Subject</th><th>Marks</th><th>Max</th><th></th></tr>
{% for m in marks %}<tr><form method="post"><input type="hidden" name="csrf" value="{{ csrf_token() }}">
<input type="hidden" name="mark_id" value="{{ m.id }}">
<td><input name="exam" value="{{ m.exam }}" required></td><td><input name="subject" value="{{ m.subject }}" required></td>
<td><input name="marks" type="number" step="0.01" min="0" value="{{ m.marks }}" required></td>
<td><input name="max_marks" type="number" step="0.01" min="1" value="{{ m.max_marks }}" required></td>
<td style="white-space:nowrap"><button class="btn sm" name="action" value="update">Save</button>
<button class="btn sm red" name="action" value="delete" formnovalidate onclick="return confirm('Delete this row?')">Delete</button></td></form></tr>
{% else %}<tr><td colspan="5" style="color:var(--mut)">No marks entered yet.</td></tr>{% endfor %}</table></div>
<div class="card"><h3 style="margin-top:0">Add marks</h3>
<form method="post" class="row"><input type="hidden" name="csrf" value="{{ csrf_token() }}">
<div><label>Exam</label><input name="exam" placeholder="Term 1" required></div>
<div><label>Subject</label><input name="subject" required></div>
<div><label>Marks</label><input name="marks" type="number" step="0.01" min="0" required></div>
<div><label>Max marks</label><input name="max_marks" type="number" step="0.01" min="1" value="100" required></div>
<div class="fit"><button class="btn" name="action" value="add">Add</button></div></form></div>{% endblock %}"""

STUDENT_HOME_HTML = """{% extends 'base.html' %}{% block title %}My Result{% endblock %}{% block body %}
<div class="card"><h2 style="margin-top:0">{{ s.name }}</h2>
<p style="color:var(--mut)">Roll no: <b>{{ s.roll_no }}</b> &nbsp; Course: <b>{{ s.course or '-' }}</b></p>
<button class="btn sec noprint" onclick="window.print()">Print</button></div>
{% for exam, ms in exams.items() %}<div class="card"><h3 style="margin-top:0">{{ exam }}</h3>
<table><tr><th>Subject</th><th>Marks</th><th>Out of</th></tr>
{% for m in ms %}<tr><td>{{ m.subject }}</td><td>{{ '%g' % m.marks }}</td><td>{{ '%g' % m.max_marks }}</td></tr>{% endfor %}
<tr><th>Total</th><th>{{ '%g' % summary[exam][0] }}</th><th>{{ '%g' % summary[exam][1] }} ({{ summary[exam][2] }}%)</th></tr></table></div>
{% else %}<div class="card" style="color:var(--mut)">Your results have not been published yet.</div>{% endfor %}{% endblock %}"""

app.jinja_loader = DictLoader({
    "base.html": BASE_HTML, "login.html": LOGIN_HTML,
    "examiner_home.html": EXAMINER_HOME_HTML, "student_form.html": STUDENT_FORM_HTML,
    "marks.html": MARKS_HTML, "student_home.html": STUDENT_HOME_HTML,
})

init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
