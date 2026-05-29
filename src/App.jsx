import { useMemo, useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CalendarDays,
  CalendarRange,
  ListTodo,
  Folder,
  FileText,
  LogOut,
} from "lucide-react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "firebase/auth";
import { db, auth, googleProvider } from "./firebase";

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const categoryColors = {
  Universidad: "bg-blue-100 text-blue-800 border-blue-200",
  Trabajo: "bg-amber-100 text-amber-800 border-amber-200",
  Personal: "bg-purple-100 text-purple-800 border-purple-200",
  Pago: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Salud: "bg-rose-100 text-rose-800 border-rose-200",
};

const priorityColors = {
  Alta: "bg-red-100 text-red-800 border-red-200",
  Media: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Baja: "bg-green-100 text-green-800 border-green-200",
};

const folderColors = [
  "bg-red-100 border-red-300 text-red-900",
  "bg-blue-100 border-blue-300 text-blue-900",
  "bg-green-100 border-green-300 text-green-900",
  "bg-yellow-100 border-yellow-300 text-yellow-900",
  "bg-purple-100 border-purple-300 text-purple-900",
  "bg-pink-100 border-pink-300 text-pink-900",
  "bg-orange-100 border-orange-300 text-orange-900",
];

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();
  const startDay = (firstDay.getDay() + 6) % 7;
  const days = [];

  for (let i = 0; i < startDay; i++) days.push(null);
  for (let day = 1; day <= totalDays; day++) days.push(new Date(year, month, day));
  while (days.length % 7 !== 0) days.push(null);

  return days;
}

function getWeekDays(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  const day = (date.getDay() + 6) % 7;
  const monday = new Date(date);

  monday.setDate(date.getDate() - day);

  return Array.from({ length: 7 }, (_, index) => {
    const weekDate = new Date(monday);
    weekDate.setDate(monday.getDate() + index);
    return weekDate;
  });
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const today = new Date();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [currentDate, setCurrentDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const [selectedDate, setSelectedDate] = useState(formatDateKey(today));
  const [events, setEvents] = useState({});
  const [newEvent, setNewEvent] = useState("");
  const [category, setCategory] = useState("Universidad");

  const [view, setView] = useState("calendar");
  const [calendarView, setCalendarView] = useState("monthly");

  const [dailyTasks, setDailyTasks] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [newDailyTask, setNewDailyTask] = useState("");
  const [dailyPriority, setDailyPriority] = useState("Media");
  const [dailyNote, setDailyNote] = useState("");

  const [folders, setFolders] = useState([]);
  const [looseNotes, setLooseNotes] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [selectedNoteType, setSelectedNoteType] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [newNoteTitle, setNewNoteTitle] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      setIsLoaded(false);
    });

    useEffect(() =>{
      async function checkRedirectResult(){
        try{
          await getRedirectResult(auth);
        } catch(error){
          console.error("Error de login:", error);
        }
      }
      checkRedirectResult();
    }, []);

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(
      doc(db, "users", user.uid, "planner", "main"),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();

          setEvents(data.events || {});
          setDailyTasks(data.dailyTasks || []);
          setFolders(data.folders || []);
          setLooseNotes(data.looseNotes || []);
        } else {
          setEvents({});
          setDailyTasks([]);
          setFolders([]);
          setLooseNotes([]);
        }

        setIsLoaded(true);
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!isLoaded || !user) return;

    async function saveData() {
      await setDoc(doc(db, "users", user.uid, "planner", "main"), {
        events,
        dailyTasks,
        folders,
        looseNotes,
      });
    }

    saveData();
  }, [events, dailyTasks, folders, looseNotes, isLoaded, user]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);
  const weekDates = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const selectedEvents = events[selectedDate] || [];
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId);

  const selectedNote =
    selectedNoteType === "loose"
      ? looseNotes.find((note) => note.id === selectedNoteId)
      : selectedFolder?.notes.find((note) => note.id === selectedNoteId);

  async function loginWithGoogle() {
    await signInWithRedirect(auth, googleProvider);
  }

  async function logout() {
    await signOut(auth);
  }

  function goToPreviousMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function goToNextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function goToToday() {
    const date = new Date();
    setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
    setSelectedDate(formatDateKey(date));
  }

  function addEvent() {
    const cleanText = newEvent.trim();

    if (!cleanText) {
      alert("Escribe una actividad.");
      return;
    }

    const event = {
      id: createId(),
      text: cleanText,
      category,
      completed: false,
    };

    setEvents((prevEvents) => ({
      ...prevEvents,
      [selectedDate]: [...(prevEvents[selectedDate] || []), event],
    }));

    setNewEvent("");
  }

  function addDailyTask() {
    const cleanText = newDailyTask.trim();

    if (!cleanText) {
      alert("Escribe una tarea.");
      return;
    }

    const task = {
      id: createId(),
      text: cleanText,
      priority: dailyPriority,
      note: dailyNote.trim(),
      completed: false,
    };

    setDailyTasks((prevTasks) => [...prevTasks, task]);
    setNewDailyTask("");
    setDailyNote("");
    setDailyPriority("Media");
  }

  function toggleEvent(dateKey, eventId) {
    setEvents((prevEvents) => ({
      ...prevEvents,
      [dateKey]: prevEvents[dateKey].map((event) =>
        event.id === eventId ? { ...event, completed: !event.completed } : event
      ),
    }));
  }

  function deleteEvent(dateKey, eventId) {
    setEvents((prevEvents) => ({
      ...prevEvents,
      [dateKey]: prevEvents[dateKey].filter((event) => event.id !== eventId),
    }));
  }

  function toggleDailyTask(taskId) {
    setDailyTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  }

  function deleteDailyTask(taskId) {
    setDailyTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
  }

  function clearCompletedDailyTasks() {
    setDailyTasks((prevTasks) => prevTasks.filter((task) => !task.completed));
  }

  function addFolder() {
    const cleanName = newFolderName.trim();

    if (!cleanName) {
      alert("Escribe el nombre de la carpeta.");
      return;
    }

    const randomColor = folderColors[Math.floor(Math.random() * folderColors.length)];

    const folder = {
      id: createId(),
      name: cleanName,
      color: randomColor,
      notes: [],
    };

    setFolders((prevFolders) => [...prevFolders, folder]);
    setSelectedFolderId(folder.id);
    setSelectedNoteId("");
    setSelectedNoteType("");
    setNewFolderName("");
  }

  function deleteFolder(folderId) {
    const confirmDelete = confirm("¿Eliminar esta carpeta y todas sus notas?");
    if (!confirmDelete) return;

    setFolders((prevFolders) => prevFolders.filter((folder) => folder.id !== folderId));

    if (selectedFolderId === folderId) {
      setSelectedFolderId("");
      setSelectedNoteId("");
      setSelectedNoteType("");
    }
  }

  function addNote() {
    const cleanTitle = newNoteTitle.trim();

    if (!cleanTitle) {
      alert("Escribe el título de la nota.");
      return;
    }

    const note = {
      id: createId(),
      title: cleanTitle,
      content: "",
      updatedAt: new Date().toISOString(),
    };

    if (!selectedFolderId) {
      setLooseNotes((prevNotes) => [...prevNotes, note]);
      setSelectedNoteType("loose");
      setSelectedNoteId(note.id);
      setNewNoteTitle("");
      return;
    }

    setFolders((prevFolders) =>
      prevFolders.map((folder) =>
        folder.id === selectedFolderId
          ? { ...folder, notes: [...folder.notes, note] }
          : folder
      )
    );

    setSelectedNoteType("folder");
    setSelectedNoteId(note.id);
    setNewNoteTitle("");
  }

  function updateNoteContent(content) {
    if (!selectedNoteId || !selectedNoteType) return;

    if (selectedNoteType === "loose") {
      setLooseNotes((prevNotes) =>
        prevNotes.map((note) =>
          note.id === selectedNoteId
            ? { ...note, content, updatedAt: new Date().toISOString() }
            : note
        )
      );
      return;
    }

    setFolders((prevFolders) =>
      prevFolders.map((folder) =>
        folder.id === selectedFolderId
          ? {
              ...folder,
              notes: folder.notes.map((note) =>
                note.id === selectedNoteId
                  ? { ...note, content, updatedAt: new Date().toISOString() }
                  : note
              ),
            }
          : folder
      )
    );
  }

  function updateNoteTitle(title) {
    if (!selectedNoteId || !selectedNoteType) return;

    if (selectedNoteType === "loose") {
      setLooseNotes((prevNotes) =>
        prevNotes.map((note) =>
          note.id === selectedNoteId
            ? { ...note, title, updatedAt: new Date().toISOString() }
            : note
        )
      );
      return;
    }

    setFolders((prevFolders) =>
      prevFolders.map((folder) =>
        folder.id === selectedFolderId
          ? {
              ...folder,
              notes: folder.notes.map((note) =>
                note.id === selectedNoteId
                  ? { ...note, title, updatedAt: new Date().toISOString() }
                  : note
              ),
            }
          : folder
      )
    );
  }

  function deleteNote(noteId) {
    const confirmDelete = confirm("¿Eliminar esta nota?");
    if (!confirmDelete) return;

    if (selectedNoteType === "loose") {
      setLooseNotes((prevNotes) => prevNotes.filter((note) => note.id !== noteId));
      setSelectedNoteId("");
      setSelectedNoteType("");
      return;
    }

    setFolders((prevFolders) =>
      prevFolders.map((folder) =>
        folder.id === selectedFolderId
          ? { ...folder, notes: folder.notes.filter((note) => note.id !== noteId) }
          : folder
      )
    );

    setSelectedNoteId("");
    setSelectedNoteType("");
  }

  function getDayEvents(date) {
    if (!date) return [];
    return events[formatDateKey(date)] || [];
  }

  function isToday(date) {
    return date && formatDateKey(date) === formatDateKey(today);
  }

  function isSelected(date) {
    return date && formatDateKey(date) === selectedDate;
  }

  function selectDate(date) {
    setSelectedDate(formatDateKey(date));
    setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Cargando sesión...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <CalendarDays className="h-7 w-7" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            Planificador personal
          </h1>

          <p className="mt-3 text-slate-500">
            Inicia sesión para guardar tus tareas, notas y actividades en tu propia cuenta.
          </p>

          <button
            onClick={loginWithGoogle}
            className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-700"
          >
            Iniciar sesión con Google
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <CalendarDays className="h-4 w-4" />
              Planificador personal
            </div>

            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {view === "tasks"
                ? "Tareas"
                : view === "notes"
                ? "Notas"
                : `${monthNames[month]} ${year}`}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Sesión iniciada como {user.displayName || user.email}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {view === "calendar" && (
              <>
                <button onClick={goToPreviousMonth} className="rounded-xl border bg-white px-4 py-2 shadow-sm hover:bg-slate-100">
                  <div className="flex items-center gap-1">
                    <ChevronLeft className="h-4 w-4" />
                    Mes anterior
                  </div>
                </button>

                <button onClick={goToToday} className="rounded-xl border bg-white px-4 py-2 shadow-sm hover:bg-slate-100">
                  Hoy
                </button>

                <button onClick={goToNextMonth} className="rounded-xl border bg-white px-4 py-2 shadow-sm hover:bg-slate-100">
                  <div className="flex items-center gap-1">
                    Mes siguiente
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </button>
              </>
            )}

            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm shadow-sm hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl bg-white p-2 shadow-sm md:grid-cols-3">
          <button
            onClick={() => setView("calendar")}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition ${
              view === "calendar" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            Calendario
          </button>

          <button
            onClick={() => setView("tasks")}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition ${
              view === "tasks" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ListTodo className="h-4 w-4" />
            Tareas
          </button>

          <button
            onClick={() => setView("notes")}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition ${
              view === "notes" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileText className="h-4 w-4" />
            Notas
          </button>
        </div>

        {!isLoaded ? (
          <div className="rounded-2xl bg-white p-6 text-center text-slate-500 shadow-sm">
            Cargando información...
          </div>
        ) : view === "notes" ? (
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <aside className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Notas</h2>
                  <p className="text-sm text-slate-500">Sueltas o por carpeta.</p>
                </div>

                <button
                  type="button"
                  onClick={addFolder}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-700"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addFolder();
                }}
                placeholder="Nombre de carpeta"
                className="mb-4 w-full rounded-xl border px-4 py-3 outline-none"
              />

              <button
                type="button"
                onClick={() => {
                  setSelectedFolderId("");
                  setSelectedNoteId("");
                  setSelectedNoteType("");
                }}
                className={`mb-4 flex w-full items-center gap-2 rounded-xl border p-3 text-left transition ${
                  !selectedFolderId && !selectedNoteType
                    ? "border-slate-900 ring-2 ring-slate-900"
                    : "border-slate-200 hover:bg-slate-100"
                }`}
              >
                <FileText className="h-4 w-4" />
                <div>
                  <p className="font-medium">Notas sueltas</p>
                  <p className="text-xs text-slate-500">{looseNotes.length} notas</p>
                </div>
              </button>

              <div className="space-y-2">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className={`flex items-center gap-2 rounded-xl border p-2 transition ${
                      selectedFolderId === folder.id
                        ? `${folder.color} ring-2 ring-slate-900`
                        : `${folder.color} opacity-80 hover:opacity-100`
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFolderId(folder.id);
                        setSelectedNoteId("");
                        setSelectedNoteType("");
                      }}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      <Folder className="h-4 w-4" />
                      <div>
                        <p className="font-medium">{folder.name}</p>
                        <p className="text-xs text-slate-500">{folder.notes.length} notas</p>
                      </div>
                    </button>

                    <button onClick={() => deleteFolder(folder.id)} className="text-slate-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </aside>

            <section className="rounded-2xl bg-white p-5 shadow-sm">
              {selectedNote ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <button
                      onClick={() => {
                        setSelectedNoteId("");
                        setSelectedNoteType("");
                      }}
                      className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-100"
                    >
                      ← Volver a notas
                    </button>

                    <button
                      onClick={() => deleteNote(selectedNote.id)}
                      className="rounded-xl border px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Eliminar nota
                    </button>
                  </div>

                  <input
                    value={selectedNote.title}
                    onChange={(e) => updateNoteTitle(e.target.value)}
                    className="w-full rounded-xl border px-4 py-3 text-2xl font-bold outline-none"
                  />

                  <textarea
                    value={selectedNote.content}
                    onChange={(e) => updateNoteContent(e.target.value)}
                    placeholder="Escribe tus apuntes aquí..."
                    className="min-h-[460px] w-full resize-none rounded-xl border px-4 py-3 outline-none"
                  />

                  <p className="text-sm text-slate-500">
                    Última edición: {new Date(selectedNote.updatedAt).toLocaleString()}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">
                        {selectedFolder ? selectedFolder.name : "Notas sueltas"}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {selectedFolder ? "Notas dentro de esta carpeta." : "Notas rápidas sin carpeta."}
                      </p>
                    </div>

                    <button
                      onClick={addNote}
                      className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-700"
                    >
                      <Plus className="h-4 w-4" />
                      Nueva nota
                    </button>
                  </div>

                  <input
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addNote();
                    }}
                    placeholder="Título para la nueva nota"
                    className="mb-5 w-full rounded-xl border px-4 py-3 outline-none"
                  />

                  {(selectedFolder ? selectedFolder.notes : looseNotes).length === 0 ? (
                    <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-500">
                      Todavía no hay notas aquí.
                    </p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {(selectedFolder ? selectedFolder.notes : looseNotes).map((note) => (
                        <button
                          key={note.id}
                          onClick={() => {
                            setSelectedNoteId(note.id);
                            setSelectedNoteType(selectedFolder ? "folder" : "loose");
                          }}
                          className="rounded-2xl border p-4 text-left transition hover:border-slate-900 hover:shadow-md"
                        >
                          <div className="mb-3 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-500" />
                            <h3 className="font-semibold">{note.title || "Sin título"}</h3>
                          </div>

                          <p className="line-clamp-3 min-h-16 text-sm text-slate-500">
                            {note.content || "Nota vacía."}
                          </p>

                          <p className="mt-4 text-xs text-slate-400">
                            Editada {new Date(note.updatedAt).toLocaleDateString()}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        ) : view === "tasks" ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="text-sm font-semibold text-slate-500">Total</p>
                  <p className="mt-2 text-3xl font-bold">{dailyTasks.length}</p>
                </div>

                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="text-sm font-semibold text-slate-500">Terminadas</p>
                  <p className="mt-2 text-3xl font-bold">
                    {dailyTasks.filter((task) => task.completed).length}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="text-sm font-semibold text-slate-500">Por hacer</p>
                  <p className="mt-2 text-3xl font-bold">
                    {dailyTasks.filter((task) => !task.completed).length}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">Mis tareas</h3>

                  <button onClick={clearCompletedDailyTasks} className="rounded-xl border px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
                    Limpiar terminadas
                  </button>
                </div>

                {dailyTasks.length === 0 ? (
                  <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-500">
                    No hay tareas pendientes.
                  </p>
                ) : (
                  dailyTasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-3 rounded-xl border p-4">
                      <input type="checkbox" checked={task.completed} onChange={() => toggleDailyTask(task.id)} />

                      <div className="flex-1">
                        <p className={`font-medium ${task.completed ? "line-through text-slate-400" : ""}`}>
                          {task.text}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${priorityColors[task.priority]}`}>
                            Prioridad {task.priority}
                          </span>

                          {task.note && (
                            <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                              {task.note}
                            </span>
                          )}
                        </div>
                      </div>

                      <button onClick={() => deleteDailyTask(task.id)} className="text-slate-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="text-xl font-bold">Nueva tarea</h3>

              <div className="mt-5 space-y-3">
                <input
                  value={newDailyTask}
                  onChange={(e) => setNewDailyTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addDailyTask();
                  }}
                  placeholder="Descripción de la tarea"
                  className="w-full rounded-xl border px-4 py-3 outline-none"
                />

                <select
                  value={dailyPriority}
                  onChange={(e) => setDailyPriority(e.target.value)}
                  className="w-full rounded-xl border px-4 py-3"
                >
                  <option>Alta</option>
                  <option>Media</option>
                  <option>Baja</option>
                </select>

                <input
                  value={dailyNote}
                  onChange={(e) => setDailyNote(e.target.value)}
                  placeholder="Nota opcional"
                  className="w-full rounded-xl border px-4 py-3 outline-none"
                />

                <button onClick={addDailyTask} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-700">
                  <Plus className="h-4 w-4" />
                  Agregar tarea
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 rounded-2xl bg-white p-2 shadow-sm md:w-fit md:grid-cols-2">
              <button
                type="button"
                onClick={() => setCalendarView("monthly")}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                  calendarView === "monthly" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                Mensual
              </button>

              <button
                type="button"
                onClick={() => setCalendarView("weekly")}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                  calendarView === "weekly" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <CalendarRange className="h-4 w-4" />
                Semanal
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              {calendarView === "monthly" && (
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="grid grid-cols-7 gap-2 border-b pb-3 text-center text-sm font-semibold text-slate-500">
                    {weekDays.map((day) => (
                      <div key={day}>{day}</div>
                    ))}
                  </div>

                  <div className="mt-3 grid grid-cols-7 gap-2">
                    {calendarDays.map((date, index) => {
                      const dayEvents = getDayEvents(date);

                      return (
                        <button
                          key={index}
                          disabled={!date}
                          onClick={() => date && selectDate(date)}
                          className={`min-h-28 rounded-2xl border bg-white p-2 text-left transition hover:shadow-md ${
                            isSelected(date) ? "border-slate-900 ring-2 ring-slate-900" : "border-slate-200"
                          }`}
                        >
                          {date && (
                            <>
                              <div className="flex items-center justify-between">
                                <span
                                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                                    isToday(date) ? "bg-slate-900 text-white" : "text-slate-700"
                                  }`}
                                >
                                  {date.getDate()}
                                </span>

                                {dayEvents.length > 0 && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                                    {dayEvents.length}
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 space-y-1">
                                {dayEvents.slice(0, 3).map((event) => (
                                  <div
                                    key={event.id}
                                    className={`truncate rounded-lg border px-2 py-1 text-xs ${
                                      categoryColors[event.category]
                                    } ${event.completed ? "line-through opacity-60" : ""}`}
                                  >
                                    {event.text}
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {calendarView === "weekly" && (
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold">Planeador semanal</h2>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {weekDates.map((date, index) => {
                      const dateKey = formatDateKey(date);
                      const dayEvents = events[dateKey] || [];

                      return (
                        <button
                          key={dateKey}
                          onClick={() => selectDate(date)}
                          className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${
                            selectedDate === dateKey ? "border-slate-900 ring-2 ring-slate-900" : "border-slate-200"
                          }`}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{weekDays[index]}</p>
                              <p className="text-sm text-slate-500">{dateKey}</p>
                            </div>

                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">
                              {dayEvents.length} tareas
                            </span>
                          </div>

                          <div className="space-y-2">
                            {dayEvents.length === 0 ? (
                              <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-500">
                                Sin actividades.
                              </p>
                            ) : (
                              dayEvents.slice(0, 4).map((event) => (
                                <p
                                  key={event.id}
                                  className={`rounded-xl border px-3 py-2 text-sm ${
                                    categoryColors[event.category]
                                  } ${event.completed ? "line-through opacity-60" : ""}`}
                                >
                                  {event.text}
                                </p>
                              ))
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div>
                  <p className="text-sm text-slate-500">Día seleccionado</p>
                  <h2 className="text-2xl font-bold">{selectedDate}</h2>
                </div>

                <div className="mt-5 space-y-3">
                  <input
                    value={newEvent}
                    onChange={(e) => setNewEvent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addEvent();
                    }}
                    placeholder="Nueva actividad"
                    className="w-full rounded-xl border px-4 py-3 outline-none"
                  />

                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border px-4 py-3">
                    <option>Universidad</option>
                    <option>Trabajo</option>
                    <option>Personal</option>
                    <option>Pago</option>
                    <option>Salud</option>
                  </select>

                  <button onClick={addEvent} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-700">
                    <Plus className="h-4 w-4" />
                    Agregar actividad
                  </button>
                </div>

                <div className="mt-6 space-y-3">
                  <h3 className="font-semibold">Actividades del día</h3>

                  {selectedEvents.length === 0 ? (
                    <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-500">
                      No hay actividades.
                    </p>
                  ) : (
                    selectedEvents.map((event) => (
                      <div key={event.id} className="flex items-start gap-3 rounded-xl border p-3">
                        <input
                          type="checkbox"
                          checked={event.completed}
                          onChange={() => toggleEvent(selectedDate, event.id)}
                        />

                        <div className="flex-1">
                          <p className={`font-medium ${event.completed ? "line-through text-slate-400" : ""}`}>
                            {event.text}
                          </p>

                          <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-xs ${categoryColors[event.category]}`}>
                            {event.category}
                          </span>
                        </div>

                        <button onClick={() => deleteEvent(selectedDate, event.id)} className="text-slate-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}