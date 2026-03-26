"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Props {
  value: string;
  onChange: (html: string) => void;
}

export default function RijkeTekstEditor({ value, onChange }: Props) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image,
      Placeholder.configure({ placeholder: "Schrijf hier de uitgebreide informatie…" }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploading(true);

    const sanitizedName = file.name.replace(/[^a-z0-9.\-_]/gi, "-").toLowerCase();
    const path = `${Date.now()}-${sanitizedName}`;

    try {
      const { error } = await supabase.storage
        .from("werkgroep-afbeeldingen")
        .upload(path, file);
      if (error) throw error;

      const { data } = supabase.storage
        .from("werkgroep-afbeeldingen")
        .getPublicUrl(path);

      editor.chain().focus().setImage({ src: data.publicUrl }).run();
    } catch {
      setUploadError("Upload mislukt. Probeer opnieuw.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const btnClass = (active: boolean) =>
    `px-2 py-1 rounded text-sm border ${
      active
        ? "bg-sky-800 text-white border-sky-800"
        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
    }`;

  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b bg-gray-50">
        <button
          type="button"
          aria-label="Titel (H2)"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btnClass(editor.isActive("heading", { level: 2 }))}
        >
          H2
        </button>
        <button
          type="button"
          aria-label="Subtitel (H3)"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={btnClass(editor.isActive("heading", { level: 3 }))}
        >
          H3
        </button>
        <button
          type="button"
          aria-label="Vetgedrukt"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btnClass(editor.isActive("bold"))}
        >
          <strong>V</strong>
        </button>
        <button
          type="button"
          aria-label="Schuingedrukt"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btnClass(editor.isActive("italic"))}
        >
          <em>S</em>
        </button>
        <button
          type="button"
          aria-label="Onderlijnd"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={btnClass(editor.isActive("underline"))}
        >
          <span className="underline">O</span>
        </button>
        <button
          type="button"
          aria-label="Ongeordende lijst"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btnClass(editor.isActive("bulletList"))}
        >
          • lijst
        </button>
        <button
          type="button"
          aria-label="Geordende lijst"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btnClass(editor.isActive("orderedList"))}
        >
          1. lijst
        </button>
        <button
          type="button"
          aria-label="Afbeelding uploaden"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={btnClass(false)}
        >
          {uploading ? "Bezig…" : "Afbeelding"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="wa-prose min-h-[200px] p-3 focus-within:outline-none"
      />

      {uploadError && (
        <div className="wa-alert-error mx-3 mb-3">{uploadError}</div>
      )}
    </div>
  );
}
