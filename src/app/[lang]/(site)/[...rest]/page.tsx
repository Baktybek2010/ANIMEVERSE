import { notFound } from "next/navigation";

/** Любой неизвестный адрес внутри сайта показывает локализованную страницу 404. */
export default function CatchAll() {
  notFound();
}
