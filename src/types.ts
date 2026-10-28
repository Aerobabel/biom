export type Person = {
  id: string;
  name: string;
  bio: string;
  city: string;
  district: string;
  interests: string[];
  avatar: string | null;
  color?: string;
  demo?: boolean;
};
export type Comment = {
  id: string;
  authorId: string;
  text: string;
  createdAt: number;
};
export type Post = {
  id: string;
  authorId: string;
  text: string;
  image: string | null;
  interest: string;
  city: string;
  district: string;
  createdAt: number;
  likes: number;
  liked: boolean;
  saved: boolean;
  comments: Comment[];
};
export type Event = {
  id: string;
  title: string;
  description: string;
  image: string;
  place: string;
  city: string;
  district: string;
  interest: string;
  date: number;
  attendees: number;
  joined: boolean;
};
export type Message = {
  id: string;
  from: string;
  to: string;
  text: string;
  createdAt: number;
  read: boolean;
};
export type AppData = {
  me: Person | null;
  isModerator: boolean;
  people: Person[];
  posts: Post[];
  events: Event[];
  unread: number;
  interests: string[];
  cities: Record<string, string[]>;
};
