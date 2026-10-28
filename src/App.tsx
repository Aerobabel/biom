import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Coffee,
  Compass,
  Flag,
  Heart,
  ImagePlus,
  Leaf,
  LogOut,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Users,
  X,
  Footprints,
  Dumbbell,
  Palette,
  BookOpen,
  Dog,
  Laptop,
  Dices,
  Plane,
  LoaderCircle,
  Ban,
  Globe,
  Copy,
  CheckCheck,
} from "lucide-react";
import type { AppData, Person, Post, Event, Message } from "./types";

const interestIcons: Record<string, typeof Coffee> = {
  "Кофе и общение": Coffee,
  Прогулки: Footprints,
  Спорт: Dumbbell,
  Искусство: Palette,
  Книги: BookOpen,
  Питомцы: Dog,
  Музыка: Music2,
  Технологии: Laptop,
  "Настольные игры": Dices,
  Путешествия: Plane,
};
const iconFor = (name: string) => interestIcons[name] || Sparkles;
async function api(path: string, body?: unknown) {
  const r = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Не удалось выполнить запрос");
  return data;
}
const relative = (date: number) => {
  const m = Math.max(0, Math.floor((Date.now() - date) / 60000));
  return m < 1
    ? "только что"
    : m < 60
      ? `${m} мин. назад`
      : m < 1440
        ? `${Math.floor(m / 60)} ч. назад`
        : new Date(date).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
          });
};
function Logo() {
  return (
    <span className="logo">
      biom
      <span className="logo-rays">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}
function Avatar({
  person,
  size = 42,
  className = "",
}: {
  person?: Person | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={"avatar " + className}
      style={{
        width: size,
        height: size,
        background: person?.color || "#e7eaff",
        fontSize: size * 0.32,
      }}
    >
      {person?.avatar ? (
        <img src={person.avatar} alt={person.name} loading="lazy" />
      ) : person ? (
        <span>
          {person.name
            .split(" ")
            .map((x) => x[0])
            .slice(0, 2)
            .join("")}
        </span>
      ) : (
        <Users size={size * 0.45} />
      )}
    </span>
  );
}
function Interest({
  name,
  active = false,
  onClick,
}: {
  name: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const Icon = iconFor(name);
  return (
    <button
      type="button"
      className={"interest " + (active ? "selected" : "")}
      onClick={onClick}
    >
      <Icon size={15} />
      {name}
    </button>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          "button,input,textarea,select,a[href]",
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    ref.current?.querySelector<HTMLElement>("button,input,textarea")?.focus();
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null),
    [loadError, setLoadError] = useState("");
  const [view, setView] = useState("feed"),
    [tab, setTab] = useState("all"),
    [filter, setFilter] = useState(""),
    [query, setQuery] = useState("");
  const [location, setLocation] = useState({
    city: "Москва",
    district: "Басманный",
  });
  const [modal, setModal] = useState(""),
    [selectedPerson, setSelectedPerson] = useState<Person | null>(null),
    [selectedEvent, setSelectedEvent] = useState<Event | null>(null),
    [reportPost, setReportPost] = useState<Post | null>(null);
  const [authMode, setAuthMode] = useState("register"),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState("");
  const [draft, setDraft] = useState(""),
    [draftInterest, setDraftInterest] = useState("Кофе и общение"),
    [draftImage, setDraftImage] = useState<string | null>(null),
    [uploading, setUploading] = useState(false);
  const [activeChat, setActiveChat] = useState<Person | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [messageText, setMessageText] = useState("");
  const [reports, setReports] = useState<any[]>([]),
    [blocks, setBlocks] = useState<Person[]>([]);
  const fileRef = useRef<HTMLInputElement>(null),
    chatEnd = useRef<HTMLDivElement>(null);
  const reload = async () => {
    try {
      const d = await api("/data");
      setData(d);
      setLoadError("");
      if (d.me) setLocation({ city: d.me.city, district: d.me.district });
      return d as AppData;
    } catch (e) {
      setLoadError((e as Error).message);
    }
  };
  useEffect(() => {
    void reload();
    try {
      const saved = JSON.parse(localStorage.getItem("biom-location") || "null");
      if (saved) setLocation(saved);
    } catch {}
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    setFormError("");
  }, [modal, authMode]);
  useEffect(() => {
    if (view !== "messages" || !data?.me) return;
    let stopped = false;
    const poll = async () => {
      try {
        const m = await api("/messages");
        if (!stopped) setMessages(m);
      } catch {}
    };
    void poll();
    const t = setInterval(poll, 6000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [view, data?.me?.id]);
  useEffect(() => {
    if (activeChat && view === "messages" && data?.me) {
      void api("/messages/read", { from: activeChat.id })
        .then(() => reload())
        .catch(() => {});
    }
  }, [activeChat?.id, view]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages.length, activeChat?.id]);
  const notify = (message: string) => setToast(message);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setFormError("");
    try {
      await fn();
    } catch (e) {
      setFormError((e as Error).message);
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const needAuth = () => {
    if (data?.me) return true;
    setAuthMode("register");
    setModal("auth");
    return false;
  };
  const open = (name: string) => {
    setFormError("");
    setModal(name);
  };
  const navigate = (name: string) => {
    setView(name);
    setQuery("");
    setFilter("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (name === "moderation")
      void api("/moderation")
        .then(setReports)
        .catch((e) => notify(e.message));
  };
  const findPerson = (id: string) =>
    data?.me?.id === id ? data.me : data?.people.find((p) => p.id === id);
  const showPerson = (person: Person) => {
    setSelectedPerson(person);
    open("person");
  };
  const startChat = (person: Person) => {
    if (!needAuth()) return;
    setActiveChat(person);
    setModal("");
    navigate("messages");
  };
  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      notify("Выберите фото до 5 МБ");
      return;
    }
    setUploading(true);
    try {
      const encoded = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const r = await api("/upload", { data: encoded });
      setDraftImage(r.url);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setUploading(false);
    }
  };
  const action = async (post: Post, act: string, body: unknown) => {
    if (!needAuth()) return;
    await run(async () => {
      await api(`/posts/${post.id}/${act}`, body);
      await reload();
    });
  };
  const join = async (event: Event) => {
    if (!needAuth()) return;
    await run(async () => {
      await api(`/events/${event.id}/join`, { active: !event.joined });
      await reload();
      setSelectedEvent({
        ...event,
        joined: !event.joined,
        attendees: event.attendees + (event.joined ? -1 : 1),
      });
      notify(
        event.joined
          ? "Вы отменили участие"
          : "Вы в списке! Увидимся на встрече",
      );
    });
  };
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      notify("Ссылка скопирована. Пригласите соседей!");
    } catch {
      open("invite");
    }
  };
  if (!data)
    return (
      <div className="loading-page">
        <Logo />
        <LoaderCircle className="spin" size={25} />
        <p>{loadError || "Собираем ваш район…"}</p>
        {loadError && (
          <button className="primary" onClick={() => void reload()}>
            Попробовать снова
          </button>
        )}
      </div>
    );
  const me = data.me;
  const localPeople = data.people.filter((p) => p.city === location.city);
  const visiblePeople = localPeople.filter(
    (p) =>
      (!filter || p.interests.includes(filter)) &&
      `${p.name} ${p.bio} ${p.interests.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const visiblePosts = data.posts.filter(
    (p) =>
      p.city === location.city &&
      (view !== "saved" || p.saved) &&
      (tab !== "near" || p.district === location.district) &&
      (tab !== "interests" ||
        !me ||
        (p.interest && me.interests.includes(p.interest))) &&
      (!filter || p.interest === filter) &&
      `${p.text} ${findPerson(p.authorId)?.name} ${p.interest}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const navItems = [
    { id: "feed", icon: Compass, label: "Моя лента" },
    { id: "people", icon: Users, label: "Люди рядом" },
    { id: "events", icon: CalendarDays, label: "Встречи" },
    {
      id: "messages",
      icon: MessageCircle,
      label: "Сообщения",
      count: data.unread,
    },
    { id: "saved", icon: Bookmark, label: "Сохранённое" },
  ];
  const names: Record<string, string> = {
    feed: "Всё хорошее — рядом",
    people: "Ваши люди где-то рядом",
    events: "Планы, которые сближают",
    messages: "Давайте общаться",
    saved: "Хочется вернуться",
    profile: "Немного о вас",
    moderation: "Заботимся о сообществе",
  };
  return (
    <>
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("feed");
          }}
          aria-label="Biom — главная"
        >
          <Logo />
          <span>СВОИ ЛЮДИ РЯДОМ</span>
        </a>
        <div className="sidebar-group-label">ВАШЕ ПРОСТРАНСТВО</div>
        <nav className="main-nav">
          {navItems.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={21} strokeWidth={1.7} />
              <span>{n.label}</span>
              {!!n.count && <b className="count">{n.count}</b>}
              {view === n.id && <i className="nav-dot" />}
            </button>
          ))}
        </nav>
        <button
          className="primary create-button"
          onClick={() => {
            if (needAuth()) open("compose");
          }}
        >
          <Plus size={20} />
          Создать публикацию
        </button>
        <div className="sidebar-divider" />
        <button
          className={"profile-nav " + (view === "profile" ? "active" : "")}
          onClick={() => navigate("profile")}
        >
          <Avatar person={me} size={33} />
          <span>Мой профиль</span>
          <ChevronRight size={17} />
        </button>
        {data.isModerator && (
          <button
            className="moderator-nav"
            onClick={() => navigate("moderation")}
          >
            <ShieldCheck size={18} />
            Модерация
          </button>
        )}
        <div className="sidebar-bottom">
          <div className="invite-card">
            <span className="invite-art">
              <Users size={32} />
              <i />
              <i />
            </span>
            <h3>Ближе друг к другу</h3>
            <p>
              Хорошие соседи делают
              <br />
              район домом.
            </p>
            <button onClick={() => void copyInvite()}>
              Пригласить друзей <ArrowUpRightIcon />
            </button>
          </div>
          <div className="sidebar-links">
            <button onClick={() => open("about")}>О Biom</button>
            <span>·</span>
            <button onClick={() => open("rules")}>Правила</button>
            <span>·</span>
            <button onClick={() => open("help")}>Помощь</button>
          </div>
          <small>
            © Biom, 2026 <span>Сделано для людей</span>
          </small>
        </div>
      </aside>
      <div className="app-shell">
        <header className="topbar">
          <div className="mobile-logo">
            <Logo />
          </div>
          <label className="search">
            <Search size={19} />
            <input
              aria-label="Поиск людей и публикаций"
              placeholder="Люди, интересы, что-то близкое…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!["feed", "people", "saved"].includes(view))
                  setView("people");
              }}
            />
            {query ? (
              <button aria-label="Очистить поиск" onClick={() => setQuery("")}>
                <X size={16} />
              </button>
            ) : (
              <span className="search-shortcut">Поиск</span>
            )}
          </label>
          <div className="topbar-actions">
            <button
              className="location-button"
              onClick={() => open("location")}
            >
              <MapPin size={18} />
              <span>
                {location.city}
                <small>{location.district}</small>
              </span>
              <ChevronDown size={15} />
            </button>
            <span className="topbar-divider" />
            <button
              className="notification-button icon-button"
              aria-label="Уведомления"
              onClick={() => open("notifications")}
            >
              <Bell size={21} />
              {data.unread > 0 && <i />}
            </button>
            <button
              className="avatar-button"
              aria-label={me ? "Мой профиль" : "Войти в Biom"}
              onClick={() =>
                me ? navigate("profile") : (setAuthMode("login"), open("auth"))
              }
            >
              <Avatar person={me} size={38} />
            </button>
          </div>
        </header>
        <main
          className={
            "workspace " + (view === "messages" ? "message-workspace" : "")
          }
        >
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="status-dot" />
                ВАШ РАЙОН. ВАШ РИТМ.
              </div>
              <h1>{names[view]}</h1>
              <p>
                {view === "feed"
                  ? "Знакомьтесь, делитесь и находите компанию по интересам."
                  : view === "people"
                    ? "От общих интересов — к настоящим знакомствам."
                    : view === "events"
                      ? "Выйдите из чата. Встретьтесь по соседству."
                      : view === "messages"
                        ? "Большая дружба начинается с маленького «привет»."
                        : view === "saved"
                          ? "Места, идеи и публикации, которые вы сохранили."
                          : view === "profile"
                            ? "Расскажите о себе — вашим людям будет проще вас найти."
                            : "Жалобы и безопасность вашего района."}
              </p>
            </div>
            <span className="heading-badge">
              <MapPin size={14} />
              {location.district}
            </span>
          </div>
          {query && (
            <div className="search-context">
              Результаты по запросу «{query}»{" "}
              <button onClick={() => setQuery("")}>
                Сбросить <X size={13} />
              </button>
            </div>
          )}
          <div
            className={
              "content-grid " +
              (["messages", "profile", "moderation"].includes(view)
                ? "full-width"
                : "")
            }
          >
            <section className="main-content">
              {view === "feed" && (
                <>
                  {!query && (
                    <div className="hero">
                      <div className="hero-copy">
                        <span className="hero-kicker">
                          <span />
                          МЕНЬШЕ РАССТОЯНИЙ, БОЛЬШЕ ОБЩЕГО
                        </span>
                        <h2>
                          Свои люди.
                          <br />
                          Буквально за углом.
                        </h2>
                        <p>
                          Кофе после работы, пробежка с утра
                          <br />
                          или просто хороший разговор.
                        </p>
                        <button
                          className="lime-button"
                          onClick={() => navigate("people")}
                        >
                          Найти своих <ArrowRight size={18} />
                        </button>
                      </div>
                      <div className="hero-art" aria-hidden="true">
                        <div className="orbit orbit-one" />
                        <div className="orbit orbit-two" />
                        <div className="hero-pin">
                          <MapPin size={61} strokeWidth={1.4} />
                          <i />
                        </div>
                        <span className="hero-person hp-one">
                          <Avatar person={localPeople[0]} size={73} />
                          <span>☕</span>
                        </span>
                        <span className="hero-person hp-two">
                          <Avatar person={localPeople[1]} size={56} />
                          <span>🏃</span>
                        </span>
                        <span className="hero-person hp-three">
                          <Avatar person={localPeople[2]} size={65} />
                          <span>✦</span>
                        </span>
                        <span className="hero-star star-one">✳</span>
                        <span className="hero-star star-two">✦</span>
                        <span className="hero-caption">
                          <span />
                          Ближе, чем кажется
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="feed-toolbar">
                    <div className="feed-tabs">
                      {[
                        { id: "all", label: "Для вас" },
                        { id: "near", label: "В моём районе" },
                        { id: "interests", label: "По интересам" },
                      ].map((t) => (
                        <button
                          className={tab === t.id ? "active" : ""}
                          key={t.id}
                          onClick={() => {
                            if (t.id === "interests" && !needAuth()) return;
                            setTab(t.id);
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <button
                      className={"filter-button " + (filter ? "selected" : "")}
                      onClick={() => open("filters")}
                      aria-label="Фильтры ленты"
                    >
                      <SlidersHorizontal size={18} />
                      <span>Фильтры</span>
                      {filter && <i />}
                    </button>
                  </div>
                  <div className="composer card">
                    <Avatar person={me} />
                    <button
                      className="composer-prompt"
                      onClick={() => {
                        if (needAuth()) open("compose");
                      }}
                    >
                      Чем живёт ваш район?
                    </button>
                    <button
                      className="composer-photo"
                      aria-label="Публикация с фото"
                      onClick={() => {
                        if (needAuth()) open("compose");
                      }}
                    >
                      <ImagePlus size={21} />
                    </button>
                    <button
                      className="composer-add"
                      aria-label="Создать публикацию"
                      onClick={() => {
                        if (needAuth()) open("compose");
                      }}
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </>
              )}
              {["feed", "saved"].includes(view) && (
                <>
                  {filter && (
                    <div className="active-filter">
                      <Interest
                        name={filter}
                        active
                        onClick={() => setFilter("")}
                      />
                      <button onClick={() => setFilter("")}>
                        <X size={14} />
                        Сбросить
                      </button>
                    </div>
                  )}
                  {visiblePosts.length ? (
                    visiblePosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        author={findPerson(post.authorId)}
                        me={me}
                        findPerson={findPerson}
                        onPerson={showPerson}
                        onAction={action}
                        onReport={() => {
                          setReportPost(post);
                          if (needAuth()) open("report");
                        }}
                        onShare={() => void copyInvite()}
                        onBlock={() =>
                          void run(async () => {
                            if (!needAuth()) return;
                            await api("/block", {
                              targetId: post.authorId,
                              active: true,
                            });
                            await reload();
                            notify(
                              "Пользователь скрыт. Управляйте блокировками в профиле.",
                            );
                          })
                        }
                        busy={busy}
                      />
                    ))
                  ) : (
                    <Empty
                      icon={view === "saved" ? Bookmark : Search}
                      title={
                        view === "saved"
                          ? "Сохраните что-то близкое"
                          : "Пока тихо"
                      }
                      text={
                        view === "saved"
                          ? "Нажмите на закладку под публикацией — она появится здесь."
                          : "Попробуйте другой интерес или станьте первым, кто расскажет о своём районе."
                      }
                      button={
                        view === "saved"
                          ? "Открыть ленту"
                          : "Создать публикацию"
                      }
                      onClick={() => {
                        if (view === "saved") navigate("feed");
                        else if (needAuth()) open("compose");
                      }}
                    />
                  )}
                </>
              )}
              {view === "people" && (
                <>
                  <div className="discover-filters">
                    <button
                      className={"interest " + (!filter ? "selected" : "")}
                      onClick={() => setFilter("")}
                    >
                      <Sparkles size={15} />
                      Все интересы
                    </button>
                    {data.interests.map((i) => (
                      <Interest
                        key={i}
                        name={i}
                        active={filter === i}
                        onClick={() => setFilter(filter === i ? "" : i)}
                      />
                    ))}
                  </div>
                  <div className="section-line">
                    <span>
                      {visiblePeople.length}{" "}
                      {visiblePeople.length === 1 ? "человек" : "человек"} в
                      вашем городе
                    </span>
                    <button onClick={() => open("location")}>
                      <MapPin size={14} />
                      Изменить район
                    </button>
                  </div>
                  <div className="people-grid">
                    {visiblePeople.map((p) => (
                      <div className="person-card card" key={p.id}>
                        <button
                          className="person-card-top"
                          onClick={() => showPerson(p)}
                        >
                          <Avatar person={p} size={78} />
                          <h3>{p.name}</h3>
                          <span>
                            <MapPin size={13} />
                            {p.district}
                          </span>
                        </button>
                        <p>{p.bio}</p>
                        <div className="small-interests">
                          {p.interests.slice(0, 2).map((i) => (
                            <span key={i}>{i}</span>
                          ))}
                        </div>
                        <button
                          className="secondary"
                          onClick={() => showPerson(p)}
                        >
                          Познакомиться <ArrowRight size={16} />
                        </button>
                        {p.demo && (
                          <span className="demo-label">Демопрофиль</span>
                        )}
                      </div>
                    ))}
                  </div>
                  {!visiblePeople.length && (
                    <Empty
                      icon={Users}
                      title="Здесь могут быть ваши люди"
                      text="Пригласите соседей или попробуйте другой интерес."
                      button="Пригласить друзей"
                      onClick={() => void copyInvite()}
                    />
                  )}
                </>
              )}
              {view === "events" && (
                <>
                  <div className="section-line">
                    <span>
                      Ближайшие встречи в{" "}
                      {location.city === "Москва" ? "Москве" : location.city}
                    </span>
                    <span className="subtle">
                      <CalendarDays size={14} />
                      Выйдем погулять?
                    </span>
                  </div>
                  <div className="events-grid">
                    {data.events
                      .filter((e) => e.city === location.city)
                      .map((event) => (
                        <div className="event-card card" key={event.id}>
                          <button
                            className="event-cover"
                            onClick={() => {
                              setSelectedEvent(event);
                              open("event");
                            }}
                          >
                            <img src={event.image} alt={event.title} />
                            <span className="event-date">
                              {new Date(event.date).getDate()}
                              <small>
                                {new Date(event.date)
                                  .toLocaleDateString("ru-RU", {
                                    month: "short",
                                  })
                                  .replace(".", "")}
                              </small>
                            </span>
                          </button>
                          <div className="event-body">
                            <span className="event-tag">{event.interest}</span>
                            <h3>{event.title}</h3>
                            <p>
                              <MapPin size={14} />
                              {event.place}
                            </p>
                            <p>
                              <CalendarDays size={14} />
                              {new Date(event.date).toLocaleString("ru-RU", {
                                weekday: "short",
                                day: "numeric",
                                month: "long",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                            <div className="event-bottom">
                              <span>
                                <Users size={15} />
                                {event.attendees} участников
                              </span>
                              <button
                                className={
                                  event.joined ? "joined secondary" : "primary"
                                }
                                disabled={busy}
                                onClick={() => void join(event)}
                              >
                                {event.joined ? (
                                  <>
                                    <Check size={16} />
                                    Вы идёте
                                  </>
                                ) : (
                                  "Я тоже иду"
                                )}
                              </button>
                            </div>
                            <span className="demo-label">
                              Пример встречи · демосообщество
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                  {!data.events.some((e) => e.city === location.city) && (
                    <Empty
                      icon={CalendarDays}
                      title="Новые встречи впереди"
                      text="Пока в этом городе нет встреч. Предложите соседям свой план в ленте."
                      button="Предложить встречу"
                      onClick={() => {
                        if (needAuth()) {
                          setDraft("Кто хочет встретиться? ");
                          open("compose");
                        }
                      }}
                    />
                  )}
                </>
              )}
              {view === "messages" &&
                (!me ? (
                  <Empty
                    icon={MessageCircle}
                    title="Ваши разговоры начинаются здесь"
                    text="Создайте профиль, чтобы писать соседям и находить новых друзей."
                    button="Присоединиться к Biom"
                    onClick={() => {
                      setAuthMode("register");
                      open("auth");
                    }}
                  />
                ) : (
                  <div className="messenger card">
                    <div className="chat-list">
                      <h3>
                        Сообщения{" "}
                        <span>
                          {
                            new Set(
                              messages.map((m) =>
                                m.from === me.id ? m.to : m.from,
                              ),
                            ).size
                          }
                        </span>
                      </h3>
                      {[
                        ...new Set([
                          ...messages.map((m) =>
                            m.from === me.id ? m.to : m.from,
                          ),
                          ...(activeChat ? [activeChat.id] : []),
                        ]),
                      ].map((id) => {
                        const p = findPerson(id);
                        if (!p) return null;
                        const conversation = messages.filter(
                          (m) => m.from === id || m.to === id,
                        );
                        return (
                          <button
                            key={id}
                            className={
                              "chat-list-item " +
                              (activeChat?.id === id ? "active" : "")
                            }
                            onClick={() => setActiveChat(p)}
                          >
                            <Avatar person={p} />
                            <span>
                              <b>{p.name.split(" ")[0]}</b>
                              <small>
                                {conversation.at(-1)?.text ||
                                  "Начните знакомство"}
                              </small>
                            </span>
                            {conversation.some(
                              (m) => m.to === me.id && !m.read,
                            ) && <i className="status-dot" />}
                          </button>
                        );
                      })}
                      {!messages.length && !activeChat && (
                        <div className="chat-list-empty">
                          <MessageCircle size={27} />
                          <p>Пока ни одного диалога</p>
                          <button onClick={() => navigate("people")}>
                            Найти людей <ArrowRight size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div
                      className={
                        "chat-conversation " + (activeChat ? "has-chat" : "")
                      }
                    >
                      {activeChat ? (
                        <>
                          <div className="chat-heading">
                            <button
                              className="icon-button mobile-back"
                              onClick={() => setActiveChat(null)}
                              aria-label="Назад к диалогам"
                            >
                              <ArrowLeft size={20} />
                            </button>
                            <Avatar person={activeChat} />
                            <button
                              className="chat-person"
                              onClick={() => showPerson(activeChat)}
                            >
                              <b>{activeChat.name}</b>
                              <small>
                                {activeChat.demo
                                  ? "Демопрофиль"
                                  : activeChat.district}
                              </small>
                            </button>
                          </div>
                          <div className="chat-bubbles">
                            <div className="chat-start">
                              <span>Здесь начинается что-то хорошее</span>
                              <p>
                                {activeChat.demo
                                  ? "Это пример профиля. Пригласите друга, чтобы попробовать настоящую переписку."
                                  : "Начните с «привет» и общего интереса ✨"}
                              </p>
                              {activeChat.demo && (
                                <button
                                  className="secondary"
                                  onClick={() => void copyInvite()}
                                >
                                  Пригласить друга <Copy size={15} />
                                </button>
                              )}
                            </div>
                            {messages
                              .filter(
                                (m) =>
                                  (m.from === me.id &&
                                    m.to === activeChat.id) ||
                                  (m.from === activeChat.id && m.to === me.id),
                              )
                              .map((m) => (
                                <div
                                  className={
                                    "bubble " +
                                    (m.from === me.id ? "outgoing" : "")
                                  }
                                  key={m.id}
                                >
                                  <p>{m.text}</p>
                                  <small>
                                    {new Date(m.createdAt).toLocaleTimeString(
                                      "ru-RU",
                                      { hour: "2-digit", minute: "2-digit" },
                                    )}
                                    {m.from === me.id &&
                                      (m.read ? (
                                        <CheckCheck size={13} />
                                      ) : (
                                        <Check size={13} />
                                      ))}
                                  </small>
                                </div>
                              ))}
                            <div ref={chatEnd} />
                          </div>
                          <form
                            className="chat-input"
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (!messageText.trim() || busy) return;
                              void run(async () => {
                                const msg = await api("/messages", {
                                  to: activeChat.id,
                                  text: messageText.trim(),
                                });
                                setMessages((m) => [...m, msg]);
                                setMessageText("");
                              });
                            }}
                          >
                            <input
                              aria-label="Сообщение"
                              placeholder={
                                activeChat.demo
                                  ? "Это демопрофиль"
                                  : "Напишите «привет»…"
                              }
                              value={messageText}
                              onChange={(e) => setMessageText(e.target.value)}
                              maxLength={2000}
                              disabled={activeChat.demo}
                            />
                            <button
                              className="primary"
                              aria-label="Отправить сообщение"
                              disabled={
                                busy || !messageText.trim() || activeChat.demo
                              }
                            >
                              <Send size={19} />
                            </button>
                          </form>
                        </>
                      ) : (
                        <Empty
                          icon={MessageCircle}
                          title="Выберите собеседника"
                          text="Общие интересы — отличный повод для первого сообщения."
                          button="Найти своих"
                          onClick={() => navigate("people")}
                        />
                      )}
                    </div>
                  </div>
                ))}
              {view === "profile" &&
                (me ? (
                  <div className="profile-page card">
                    <div className="profile-cover">
                      <span>Ваш маленький большой мир.</span>
                      <Sparkles size={90} />
                    </div>
                    <div className="profile-details">
                      <div className="profile-main">
                        <Avatar person={me} size={100} />
                        <button
                          className="secondary"
                          onClick={() => open("edit-profile")}
                        >
                          <Settings2 size={17} />
                          Редактировать
                        </button>
                      </div>
                      <h2>{me.name}</h2>
                      <div className="profile-location">
                        <MapPin size={16} />
                        {me.city} · {me.district}
                      </div>
                      <p className="profile-bio">
                        {me.bio ||
                          "У вас обязательно есть что-то общее с соседями. Расскажите о себе!"}
                      </p>
                      <h4>Меня объединяет с людьми</h4>
                      <div className="discover-filters">
                        {me.interests.map((i) => (
                          <Interest
                            key={i}
                            name={i}
                            onClick={() => {
                              navigate("people");
                              setFilter(i);
                            }}
                          />
                        ))}
                      </div>
                      <div className="profile-stats">
                        <div>
                          <b>
                            {
                              data.posts.filter((p) => p.authorId === me.id)
                                .length
                            }
                          </b>
                          <span>публикаций</span>
                        </div>
                        <div>
                          <b>{data.posts.filter((p) => p.saved).length}</b>
                          <span>сохранено</span>
                        </div>
                        <div>
                          <b>{data.events.filter((e) => e.joined).length}</b>
                          <span>встреч</span>
                        </div>
                      </div>
                      <div className="profile-actions">
                        <button
                          onClick={() => {
                            void api("/blocks")
                              .then(setBlocks)
                              .then(() => open("blocks"))
                              .catch((e) => notify(e.message));
                          }}
                        >
                          <Ban size={17} />
                          Заблокированные пользователи{" "}
                          <ChevronRight size={17} />
                        </button>
                        <button
                          onClick={() =>
                            void run(async () => {
                              await api("/auth/logout", {});
                              setMessages([]);
                              setActiveChat(null);
                              await reload();
                              navigate("feed");
                              notify("Вы вышли из аккаунта");
                            })
                          }
                        >
                          <LogOut size={17} />
                          Выйти из аккаунта <ChevronRight size={17} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="join-page card">
                    <span className="join-icon">
                      <Leaf size={42} />
                    </span>
                    <h2>Вы уже почти среди своих</h2>
                    <p>
                      Пара слов о себе, несколько интересов —<br />и целый район
                      новых знакомств.
                    </p>
                    <button
                      className="primary"
                      onClick={() => {
                        setAuthMode("register");
                        open("auth");
                      }}
                    >
                      Создать профиль <ArrowRight size={17} />
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        setAuthMode("login");
                        open("auth");
                      }}
                    >
                      У меня уже есть аккаунт
                    </button>
                  </div>
                ))}
              {view === "moderation" && data.isModerator && (
                <div className="moderation-list">
                  {reports.length ? (
                    reports.map((r) => (
                      <div className="card report-card" key={r.id}>
                        <div>
                          <span className="event-tag">
                            {r.status === "pending"
                              ? "На рассмотрении"
                              : r.status === "hide"
                                ? "Публикация скрыта"
                                : r.status === "restore"
                                  ? "Восстановлена"
                                  : "Отклонена"}
                          </span>
                          <h3>{r.reason}</h3>
                          <small>{relative(r.createdAt)}</small>
                        </div>
                        <p>{r.post?.text || "Публикация недоступна"}</p>
                        <div>
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await api(
                                  "/moderation/" + encodeURIComponent(r.id),
                                  {
                                    action: r.post?.hidden ? "restore" : "hide",
                                  },
                                );
                                setReports(await api("/moderation"));
                                await reload();
                              })
                            }
                          >
                            {r.post?.hidden
                              ? "Восстановить"
                              : "Скрыть публикацию"}
                          </button>
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await api(
                                  "/moderation/" + encodeURIComponent(r.id),
                                  { action: "dismiss" },
                                );
                                setReports(await api("/moderation"));
                              })
                            }
                          >
                            Отклонить жалобу
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Empty
                      icon={ShieldCheck}
                      title="В районе спокойно"
                      text="Здесь появятся жалобы на публикации. Модератор может скрыть запись, восстановить её или отклонить жалобу."
                    />
                  )}
                </div>
              )}
            </section>
            {!["messages", "profile", "moderation"].includes(view) && (
              <aside className="right-column">
                <div className="neighborhood card">
                  <div className="neighborhood-top">
                    <span className="neighborhood-icon">
                      <MapPin size={20} />
                    </span>
                    <span>ВАШ РАЙОН</span>
                    <button
                      aria-label="Изменить район"
                      onClick={() => open("location")}
                    >
                      <ChevronDown size={17} />
                    </button>
                  </div>
                  <h3>{location.district}</h3>
                  <p>Большой город. Маленький круг своих.</p>
                  <div className="mini-map" aria-hidden="true">
                    <div className="map-road road-one" />
                    <div className="map-road road-two" />
                    <div className="map-river" />
                    <span className="map-park park-one" />
                    <span className="map-park park-two" />
                    <span className="map-label">{location.district}</span>
                    <span className="map-avatar ma-one">
                      <Avatar person={localPeople[0]} size={33} />
                    </span>
                    <span className="map-avatar ma-two">
                      <Avatar person={localPeople[1]} size={31} />
                    </span>
                    <span className="map-avatar ma-three">
                      <Avatar person={localPeople[2]} size={29} />
                    </span>
                    <span className="map-you">
                      <i />
                    </span>
                  </div>
                  <button
                    className="neighborhood-link"
                    onClick={() => navigate("people")}
                  >
                    {
                      localPeople.filter(
                        (p) => p.district === location.district,
                      ).length
                    }{" "}
                    человек по соседству <ArrowRight size={16} />
                  </button>
                </div>
                <div className="nearby card">
                  <div className="card-heading">
                    <h3>Возможно, ваши люди</h3>
                    <Sparkles size={17} />
                  </div>
                  <p className="card-description">Вы ближе, чем кажется</p>
                  <div className="nearby-list">
                    {localPeople.slice(0, 3).map((p) => (
                      <div className="nearby-person" key={p.id}>
                        <button onClick={() => showPerson(p)}>
                          <Avatar person={p} size={44} />
                          <span>
                            <b>
                              {p.name.split(" ")[0]} {p.name.split(" ")[1]}
                            </b>
                            <small>{p.interests.slice(0, 2).join(" · ")}</small>
                          </span>
                        </button>
                        <button
                          className="person-plus"
                          onClick={() => showPerson(p)}
                          aria-label={"Познакомиться: " + p.name}
                        >
                          <Plus size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {!localPeople.length && (
                    <p className="muted">Пригласите первых соседей</p>
                  )}
                  <button
                    className="see-all"
                    onClick={() => navigate("people")}
                  >
                    Все люди рядом <ArrowRight size={16} />
                  </button>
                </div>
                <div className="interest-card card">
                  <div className="card-heading">
                    <h3>Что вам близко?</h3>
                    <span>✳</span>
                  </div>
                  <div className="right-interests">
                    {data.interests.slice(0, 6).map((i) => (
                      <Interest
                        key={i}
                        name={i}
                        active={filter === i}
                        onClick={() => {
                          if (!["feed", "people"].includes(view))
                            navigate("people");
                          setFilter(filter === i ? "" : i);
                        }}
                      />
                    ))}
                  </div>
                  <button
                    className="see-all"
                    onClick={() => {
                      navigate("people");
                    }}
                  >
                    Найти по интересам <ArrowRight size={16} />
                  </button>
                </div>
                {data.events
                  .filter((e) => e.city === location.city)
                  .slice(0, 1)
                  .map((event) => (
                    <div className="small-event card" key={event.id}>
                      <div className="card-heading">
                        <h3>Скоро по соседству</h3>
                        <CalendarDays size={17} />
                      </div>
                      <button
                        className="small-event-cover"
                        onClick={() => {
                          setSelectedEvent(event);
                          open("event");
                        }}
                      >
                        <img
                          src={event.image}
                          alt="Зелёный парк для прогулки"
                        />
                        <span>
                          {new Date(event.date).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          · 10:00
                        </span>
                      </button>
                      <h4>{event.title}</h4>
                      <p>
                        <MapPin size={13} />
                        {event.place}
                      </p>
                      <div className="small-event-bottom">
                        <span>
                          <Users size={14} />
                          {event.attendees} участников
                        </span>
                        <button
                          onClick={() => {
                            setSelectedEvent(event);
                            open("event");
                          }}
                        >
                          Подробнее <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                <p className="demo-note">
                  <Leaf size={13} />
                  Вы исследуете демосообщество.
                  <br />
                  Реальные знакомства начинаются с вас.
                </p>
              </aside>
            )}
          </div>
        </main>
        <footer className="mobile-nav">
          {navItems.slice(0, 4).map((n) => (
            <button
              key={n.id}
              onClick={() => navigate(n.id)}
              className={view === n.id ? "active" : ""}
            >
              <n.icon size={22} />
              <span>
                {n.id === "feed"
                  ? "Лента"
                  : n.id === "people"
                    ? "Люди"
                    : n.label}
              </span>
              {!!n.count && <i />}
            </button>
          ))}
          <button
            className={view === "profile" ? "active" : ""}
            onClick={() => navigate("profile")}
          >
            <Avatar person={me} size={23} />
            <span>Профиль</span>
          </button>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={17} />
          </span>
          {toast}
          <button onClick={() => setToast("")} aria-label="Закрыть уведомление">
            <X size={15} />
          </button>
        </div>
      )}
      {modal === "auth" && (
        <Modal
          title={
            authMode === "register"
              ? "Хорошо, когда рядом свои"
              : "С возвращением в Biom"
          }
          onClose={() => setModal("")}
          wide
        >
          <AuthForm
            mode={authMode}
            setMode={setAuthMode}
            data={data}
            location={location}
            busy={busy}
            error={formError}
            onSubmit={(body) =>
              void run(async () => {
                await api("/auth/" + authMode, body);
                await reload();
                setModal("");
                notify(
                  authMode === "register"
                    ? "Добро пожаловать в ваш район!"
                    : "Рады видеть вас снова",
                );
              })
            }
          />
        </Modal>
      )}
      {modal === "edit-profile" && me && (
        <Modal title="Ваш профиль" onClose={() => setModal("")} wide>
          <ProfileForm
            person={me}
            data={data}
            busy={busy}
            error={formError}
            onSubmit={(body) =>
              void run(async () => {
                await api("/profile", body);
                await reload();
                setModal("");
                notify("Профиль обновлён");
              })
            }
          />
        </Modal>
      )}
      {modal === "compose" && (
        <Modal title="Поделитесь с соседями" onClose={() => setModal("")} wide>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              void run(async () => {
                await api("/posts", {
                  text: draft.trim(),
                  interest: draftInterest,
                  image: draftImage,
                });
                setDraft("");
                setDraftImage(null);
                setModal("");
                navigate("feed");
                await reload();
                notify("Ваша публикация уже в ленте");
              });
            }}
          >
            <div className="compose-author">
              <Avatar person={me} />
              <span>
                <b>{me?.name}</b>
                <small>
                  <MapPin size={12} />
                  {me?.city} · {me?.district}
                </small>
              </span>
            </div>
            <textarea
              className="compose-text"
              placeholder="Расскажите о находке, задайте вопрос или предложите встретиться…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
              required
              autoFocus
            />
            <div className="character-count">{draft.length}/2000</div>
            {draftImage && (
              <div className="upload-preview">
                <img src={draftImage} alt="Фото для публикации" />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Убрать фото"
                  onClick={() => setDraftImage(null)}
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <label className="form-label">
              Интерес
              <select
                value={draftInterest}
                onChange={(e) => setDraftInterest(e.target.value)}
              >
                {data.interests.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </label>
            <input
              className="hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              ref={fileRef}
              onChange={(e) => {
                if (e.target.files?.[0]) void upload(e.target.files[0]);
                e.target.value = "";
              }}
            />
            <div className="compose-actions">
              <button
                type="button"
                className="text-button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <LoaderCircle className="spin" size={19} />
                ) : (
                  <ImagePlus size={20} />
                )}
                Добавить фото
              </button>
              <small>JPG, PNG, WebP · до 5 МБ</small>
            </div>
            {formError && <p className="form-error">{formError}</p>}
            <button
              className="primary full"
              disabled={busy || uploading || !draft.trim()}
            >
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Plus size={18} />
              )}
              Опубликовать
            </button>
          </form>
        </Modal>
      )}
      {modal === "location" && (
        <Modal title="Где ваши люди?" onClose={() => setModal("")}>
          <p className="modal-intro">
            Выберите город и район. Мы покажем людей, публикации и встречи
            поблизости.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const next = {
                city: String(fd.get("city")),
                district: String(fd.get("district")),
              };
              void run(async () => {
                if (me) await api("/profile", { ...me, ...next });
                setLocation(next);
                localStorage.setItem("biom-location", JSON.stringify(next));
                if (me) await reload();
                setModal("");
                notify("Теперь вы в районе " + next.district);
              });
            }}
          >
            <LocationFields cities={data.cities} initial={location} />
            <p className="privacy-note">
              <ShieldCheck size={17} />
              Точный адрес не нужен — только ваш район.
            </p>
            {formError && <p className="form-error">{formError}</p>}
            <button className="primary full" disabled={busy}>
              <MapPin size={17} />
              Это мой район
            </button>
          </form>
        </Modal>
      )}
      {modal === "person" && selectedPerson && (
        <Modal title="Ваши люди рядом" onClose={() => setModal("")}>
          <div className="person-modal">
            <Avatar person={selectedPerson} size={94} />
            <h2>{selectedPerson.name}</h2>
            <span className="profile-location">
              <MapPin size={15} />
              {selectedPerson.city} · {selectedPerson.district}
            </span>
            <p>{selectedPerson.bio}</p>
            <div className="discover-filters">
              {selectedPerson.interests.map((i) => (
                <Interest
                  key={i}
                  name={i}
                  onClick={() => {
                    setModal("");
                    navigate("people");
                    setFilter(i);
                  }}
                />
              ))}
            </div>
            {selectedPerson.demo && (
              <p className="privacy-note">
                <Sparkles size={19} />
                Это демопрофиль, созданный для знакомства с Biom. Для настоящего
                общения пригласите друзей.
              </p>
            )}
            <button
              className="primary full"
              onClick={() =>
                selectedPerson.demo
                  ? void copyInvite()
                  : startChat(selectedPerson)
              }
            >
              {selectedPerson.demo ? (
                <Copy size={18} />
              ) : (
                <MessageCircle size={18} />
              )}{" "}
              {selectedPerson.demo
                ? "Пригласить друзей в Biom"
                : "Написать сообщение"}
            </button>
          </div>
        </Modal>
      )}
      {modal === "filters" && (
        <Modal title="Больше того, что вам близко" onClose={() => setModal("")}>
          <p className="modal-intro">Выберите интерес для ленты.</p>
          <div className="discover-filters">
            <button
              className={"interest " + (!filter ? "selected" : "")}
              onClick={() => setFilter("")}
            >
              <Sparkles size={15} />
              Все интересы
            </button>
            {data.interests.map((i) => (
              <Interest
                key={i}
                name={i}
                active={filter === i}
                onClick={() => setFilter(filter === i ? "" : i)}
              />
            ))}
          </div>
          <button
            className="primary full filter-apply"
            onClick={() => setModal("")}
          >
            Показать публикации <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {modal === "event" && selectedEvent && (
        <Modal title="Встретимся по соседству" onClose={() => setModal("")}>
          <img
            className="event-modal-cover"
            src={selectedEvent.image}
            alt={selectedEvent.title}
          />
          <span className="event-tag">{selectedEvent.interest}</span>
          <h2 className="event-modal-title">{selectedEvent.title}</h2>
          <p className="modal-intro">{selectedEvent.description}</p>
          <p className="event-detail">
            <MapPin size={18} />
            {selectedEvent.place}
          </p>
          <p className="event-detail">
            <CalendarDays size={18} />
            {new Date(selectedEvent.date).toLocaleString("ru-RU", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="event-detail">
            <Users size={18} />
            {selectedEvent.attendees} участников
          </p>
          <p className="privacy-note">
            <Sparkles size={18} />
            Пример встречи в демосообществе.
          </p>
          <button
            className="primary full"
            disabled={busy}
            onClick={() => void join(selectedEvent)}
          >
            {selectedEvent.joined ? (
              <>
                <Check size={18} />
                Вы идёте · отменить
              </>
            ) : (
              <>
                Я тоже иду <ArrowRight size={17} />
              </>
            )}
          </button>
        </Modal>
      )}
      {modal === "report" && reportPost && (
        <Modal title="Помогите сохранить уют" onClose={() => setModal("")}>
          <p className="modal-intro">
            Что не так с этой публикацией? Жалобу увидит модератор сообщества.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const reason = String(
                new FormData(e.currentTarget).get("reason"),
              );
              void run(async () => {
                await api(`/posts/${reportPost.id}/report`, { reason });
                setModal("");
                notify("Жалоба отправлена модератору. Спасибо за заботу.");
              });
            }}
          >
            <div className="report-options">
              {["Спам", "Оскорбления", "Опасный контент", "Другое"].map(
                (s, i) => (
                  <label key={s}>
                    <input
                      type="radio"
                      name="reason"
                      value={s}
                      defaultChecked={i === 0}
                    />
                    {s}
                  </label>
                ),
              )}
            </div>
            <button className="primary full" disabled={busy}>
              <Flag size={17} />
              Отправить жалобу
            </button>
          </form>
        </Modal>
      )}
      {modal === "notifications" && (
        <Modal title="Уведомления" onClose={() => setModal("")}>
          <Empty
            icon={Bell}
            title={data.unread ? "Вам написали!" : "Здесь пока тихо"}
            text={
              data.unread
                ? `Новых сообщений: ${data.unread}. Самое время ответить.`
                : "Когда вам напишут, здесь появится уведомление."
            }
            button="Открыть сообщения"
            onClick={() => {
              setModal("");
              navigate("messages");
            }}
          />
        </Modal>
      )}
      {modal === "blocks" && (
        <Modal
          title="Заблокированные пользователи"
          onClose={() => setModal("")}
        >
          {blocks.length ? (
            blocks.map((p) => (
              <div className="blocked-row" key={p.id}>
                <Avatar person={p} />
                <b>{p.name}</b>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api("/block", { targetId: p.id, active: false });
                      setBlocks(await api("/blocks"));
                      await reload();
                    })
                  }
                >
                  Разблокировать
                </button>
              </div>
            ))
          ) : (
            <p className="modal-intro">Вы никого не заблокировали.</p>
          )}
        </Modal>
      )}
      {["about", "rules", "help", "invite"].includes(modal) && (
        <Modal
          title={
            modal === "about"
              ? "Biom — свои люди рядом"
              : modal === "rules"
                ? "Бережно друг к другу"
                : modal === "invite"
                  ? "Соседям здесь будут рады"
                  : "Как устроен Biom"
          }
          onClose={() => setModal("")}
        >
          <div className="prose">
            {modal === "about" ? (
              <>
                <Logo />
                <p>
                  Большой город становится уютнее, когда в нём есть свои люди.
                  Biom помогает найти их поблизости — через общие интересы,
                  разговоры и встречи.
                </p>
                <p>
                  Это первая версия продукта. Демопрофили, публикации и встречи
                  показывают, как может жить ваше сообщество. Регистрация, ваши
                  публикации, комментарии и переписки работают с настоящими
                  аккаунтами.
                </p>
              </>
            ) : modal === "rules" ? (
              <>
                <p>
                  Будьте доброжелательны. За каждым профилем — человек, который
                  тоже хочет чувствовать себя дома.
                </p>
                <ul>
                  <li>Общайтесь уважительно, без оскорблений и травли.</li>
                  <li>Не публикуйте спам, опасный или незаконный контент.</li>
                  <li>Берегите личные данные — свои и чужие.</li>
                  <li>Для первой встречи выбирайте общественное место.</li>
                </ul>
                <p>
                  Пожаловаться на запись или скрыть пользователя можно через
                  меню «···» у публикации.
                </p>
              </>
            ) : modal === "invite" ? (
              <>
                <p>Отправьте друзьям эту ссылку:</p>
                <input
                  readOnly
                  value={window.location.origin}
                  onFocus={(e) => e.target.select()}
                />
              </>
            ) : (
              <>
                <p>
                  <b>1. Найдите свой район.</b> Выберите город и район в верхней
                  части экрана.
                </p>
                <p>
                  <b>2. Расскажите о себе.</b> Создайте профиль и выберите
                  интересы.
                </p>
                <p>
                  <b>3. Начните знакомство.</b> Пишите публикации, комментируйте
                  и приглашайте соседей на встречи.
                </p>
                <p>
                  <b>Личные сообщения</b> доступны между зарегистрированными
                  пользователями. Демопрофили на них не отвечают.
                </p>
                <p>
                  В первой версии доступ восстанавливается через администратора;
                  автоматического сброса пароля пока нет.
                </p>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function ArrowUpRightIcon() {
  return <ArrowRight size={16} style={{ transform: "rotate(-40deg)" }} />;
}
function Empty({
  icon: Icon,
  title,
  text,
  button,
  onClick,
}: {
  icon: typeof Users;
  title: string;
  text: string;
  button?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={31} strokeWidth={1.5} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {button && (
        <button className="secondary" onClick={onClick}>
          {button}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
function PostCard({
  post,
  author,
  me,
  findPerson,
  onPerson,
  onAction,
  onReport,
  onShare,
  onBlock,
  busy,
}: {
  post: Post;
  author?: Person | null;
  me: Person | null;
  findPerson: (id: string) => Person | undefined | null;
  onPerson: (p: Person) => void;
  onAction: (p: Post, a: string, b: unknown) => Promise<void>;
  onReport: () => void;
  onShare: () => void;
  onBlock: () => void;
  busy: boolean;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false),
    [comment, setComment] = useState(""),
    [menu, setMenu] = useState(false);
  const Icon = iconFor(post.interest);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);
  return (
    <article className="post card">
      <div className="post-header">
        <button
          className="post-person"
          onClick={() => author && onPerson(author)}
        >
          <Avatar person={author} size={44} />
          <span>
            <b>{author?.name || "Сосед"}</b>
            <small>
              {post.district}
              <i>·</i>
              {relative(post.createdAt)}
              {author?.demo && (
                <>
                  <i>·</i>
                  <span>демо</span>
                </>
              )}
            </small>
          </span>
        </button>
        <span className="post-interest">
          <Icon size={13} />
          {post.interest}
        </span>
        <div className="post-menu">
          <button
            className="icon-button"
            aria-label="Действия с публикацией"
            aria-expanded={menu}
            onClick={(e) => {
              e.stopPropagation();
              setMenu(!menu);
            }}
          >
            <MoreHorizontal size={21} />
          </button>
          {menu && (
            <div className="dropdown">
              <button
                onClick={() =>
                  void onAction(post, "save", { active: !post.saved })
                }
              >
                <Bookmark size={16} />
                {post.saved ? "Убрать из сохранённого" : "Сохранить"}
              </button>
              {post.authorId === me?.id ? (
                <button onClick={() => void onAction(post, "delete", {})}>
                  <X size={16} />
                  Удалить свою публикацию
                </button>
              ) : (
                <>
                  <button onClick={onReport}>
                    <Flag size={16} />
                    Пожаловаться
                  </button>
                  <button onClick={onBlock}>
                    <Ban size={16} />
                    Скрыть пользователя
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="post-text">{post.text}</p>
      {post.image && (
        <button
          className="post-image"
          onClick={() => setCommentsOpen(true)}
          aria-label="Открыть обсуждение публикации"
        >
          <img
            src={post.image}
            alt={
              post.interest === "Кофе и общение"
                ? "Уютная кофейня с солнечными окнами"
                : post.interest === "Спорт"
                  ? "Зелёный парк для прогулок и пробежек"
                  : "Фото к публикации"
            }
            loading="lazy"
          />
        </button>
      )}
      <div className="post-actions">
        <button
          className={post.liked ? "liked" : ""}
          disabled={busy}
          onClick={() => void onAction(post, "like", { active: !post.liked })}
          aria-label={post.liked ? "Убрать реакцию" : "Нравится"}
        >
          <Heart size={20} fill={post.liked ? "currentColor" : "none"} />
          <span>{post.likes}</span>
        </button>
        <button
          className={commentsOpen ? "selected" : ""}
          onClick={() => setCommentsOpen(!commentsOpen)}
          aria-label="Комментарии"
        >
          <MessageCircle size={20} />
          <span>{post.comments.length || "Обсудить"}</span>
        </button>
        <button onClick={onShare} aria-label="Поделиться ссылкой на Biom">
          <Send size={19} />
        </button>
        <button
          className={"post-save " + (post.saved ? "selected" : "")}
          disabled={busy}
          onClick={() => void onAction(post, "save", { active: !post.saved })}
          aria-label={
            post.saved ? "Убрать из сохранённого" : "Сохранить публикацию"
          }
        >
          <Bookmark size={20} fill={post.saved ? "currentColor" : "none"} />
        </button>
      </div>
      {commentsOpen && (
        <div className="comments">
          {post.comments.map((c) => (
            <div className="comment" key={c.id}>
              <button
                className="avatar-button"
                onClick={() => {
                  const p = findPerson(c.authorId);
                  if (p) onPerson(p);
                }}
              >
                <Avatar person={findPerson(c.authorId)} size={31} />
              </button>
              <div>
                <b>
                  {findPerson(c.authorId)?.name || "Сосед"}
                  <small>{relative(c.createdAt)}</small>
                </b>
                <p>{c.text}</p>
              </div>
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!comment.trim()) return;
              void onAction(post, "comment", { text: comment.trim() }).then(
                () => {
                  if (me) setComment("");
                },
              );
            }}
          >
            <Avatar person={me} size={32} />
            <input
              aria-label="Ваш комментарий"
              placeholder="Поддержите разговор…"
              value={comment}
              maxLength={600}
              onChange={(e) => setComment(e.target.value)}
            />
            <button
              aria-label="Отправить комментарий"
              disabled={busy || !comment.trim()}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
function LocationFields({
  cities,
  initial,
}: {
  cities: Record<string, string[]>;
  initial: { city: string; district: string };
}) {
  const [city, setCity] = useState(initial.city);
  return (
    <div className="location-fields">
      <label className="form-label">
        Город
        <select
          name="city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        >
          {Object.keys(cities).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="form-label">
        Район
        <select
          name="district"
          key={city}
          defaultValue={
            cities[city]?.includes(initial.district)
              ? initial.district
              : cities[city]?.[0]
          }
        >
          {cities[city]?.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
function ProfileFields({
  person,
  data,
}: {
  person: Partial<Person>;
  data: AppData;
}) {
  const [selected, setSelected] = useState<string[]>(
    person.interests || ["Кофе и общение", "Прогулки"],
  );
  return (
    <>
      <label className="form-label">
        Как вас зовут?
        <input
          name="name"
          placeholder="Имя и фамилия"
          defaultValue={person.name}
          maxLength={60}
          minLength={2}
          autoComplete="name"
          required
        />
      </label>
      <label className="form-label">
        Пара слов о себе <span>необязательно</span>
        <textarea
          name="bio"
          placeholder="Что вы любите? Кого хотели бы встретить?"
          defaultValue={person.bio}
          maxLength={280}
        />
      </label>
      <LocationFields
        cities={data.cities}
        initial={{
          city: person.city || "Москва",
          district: person.district || "Басманный",
        }}
      />
      <label className="form-label">
        Что вам близко? <span>от 1 до 6 интересов</span>
      </label>
      <input type="hidden" name="interests" value={JSON.stringify(selected)} />
      <div className="discover-filters form-interests">
        {data.interests.map((i) => (
          <Interest
            key={i}
            name={i}
            active={selected.includes(i)}
            onClick={() =>
              setSelected(
                selected.includes(i)
                  ? selected.filter((x) => x !== i)
                  : selected.length < 6
                    ? [...selected, i]
                    : selected,
              )
            }
          />
        ))}
      </div>
    </>
  );
}
function AuthForm({
  mode,
  setMode,
  data,
  location,
  busy,
  error,
  onSubmit,
}: {
  mode: string;
  setMode: (s: string) => void;
  data: AppData;
  location: { city: string; district: string };
  busy: boolean;
  error: string;
  onSubmit: (body: unknown) => void;
}) {
  const [step, setStep] = useState(1);
  useEffect(() => setStep(1), [mode]);
  return (
    <>
      <p className="modal-intro">
        {mode === "register"
          ? "Найдите тех, с кем у вас больше общего, чем один адрес."
          : "Ваш район и ваши люди уже ждут."}
      </p>
      <div className="auth-tabs">
        <button
          className={mode === "register" ? "active" : ""}
          onClick={() => setMode("register")}
        >
          Регистрация
        </button>
        <button
          className={mode === "login" ? "active" : ""}
          onClick={() => setMode("login")}
        >
          Вход
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === "register" && step === 1) {
            setStep(2);
            return;
          }
          const fd = new FormData(e.currentTarget);
          const body: any = {
            email: fd.get("email"),
            password: fd.get("password"),
          };
          if (mode === "register")
            body.profile = {
              name: fd.get("name"),
              bio: fd.get("bio"),
              city: fd.get("city"),
              district: fd.get("district"),
              interests: JSON.parse(String(fd.get("interests"))),
            };
          onSubmit(body);
        }}
      >
        <div className={mode === "register" && step === 2 ? "hidden" : ""}>
          <label className="form-label">
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              maxLength={254}
              required
            />
          </label>
          <label className="form-label">
            Пароль
            <input
              type="password"
              name="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              placeholder={
                mode === "register" ? "Не менее 8 символов" : "Ваш пароль"
              }
              minLength={mode === "register" ? 8 : 1}
              maxLength={128}
              required
            />
          </label>
        </div>
        {mode === "register" && step === 2 && (
          <div>
            <button
              type="button"
              className="back-link"
              onClick={() => setStep(1)}
            >
              <ArrowLeft size={15} />
              Назад к данным аккаунта
            </button>
            <ProfileFields person={location} data={data} />
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={18} /> : null}
          {mode === "register"
            ? step === 1
              ? "Продолжить"
              : "Присоединиться к Biom"
            : "Войти"}
          {!busy && <ArrowRight size={17} />}
        </button>
        <p className="auth-footnote">
          <ShieldCheck size={14} />
          {mode === "register"
            ? step === 1
              ? "Без рекламы. Без лишнего шума. Просто люди."
              : "Ваш email не виден другим пользователям."
            : "На этом устройстве вход сохранится на 30 дней."}
        </p>
      </form>
    </>
  );
}
function ProfileForm({
  person,
  data,
  busy,
  error,
  onSubmit,
}: {
  person: Person;
  data: AppData;
  busy: boolean;
  error: string;
  onSubmit: (body: unknown) => void;
}) {
  const [avatar, setAvatar] = useState(person.avatar);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const uploadAvatar = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Выберите фото до 5 МБ");
      return;
    }
    setUploadBusy(true);
    setPhotoError("");
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await api("/upload", { data });
      setAvatar(result.url);
    } catch (e) {
      setPhotoError((e as Error).message);
    } finally {
      setUploadBusy(false);
    }
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onSubmit({
          ...person,
          avatar,
          name: fd.get("name"),
          bio: fd.get("bio"),
          city: fd.get("city"),
          district: fd.get("district"),
          interests: JSON.parse(String(fd.get("interests"))),
        });
      }}
    >
      <div className="profile-photo-edit">
        <Avatar person={{ ...person, avatar }} size={64} />
        <div>
          <button
            type="button"
            className="text-button"
            disabled={uploadBusy}
            onClick={() => photoInput.current?.click()}
          >
            {uploadBusy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Camera size={16} />
            )}
            Изменить фото
          </button>
          <small>JPG, PNG, WebP · до 5 МБ</small>
        </div>
        <input
          type="file"
          ref={photoInput}
          className="hidden"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            if (e.target.files?.[0]) void uploadAvatar(e.target.files[0]);
            e.target.value = "";
          }}
        />
      </div>
      {photoError && <p className="form-error">{photoError}</p>}
      <ProfileFields person={person} data={data} />
      {error && <p className="form-error">{error}</p>}
      <button className="primary full" disabled={busy || uploadBusy}>
        {busy ? (
          <LoaderCircle className="spin" size={17} />
        ) : (
          <Check size={17} />
        )}
        Сохранить изменения
      </button>
    </form>
  );
}
