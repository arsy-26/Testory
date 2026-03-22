"use client";

import { useState } from "react";

interface UploadResult {
  secure_url: string;
}

export default function ProductForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState<number>(0);

  async function handleUpload() {
    if (files.length === 0) return alert("Pilih gambar dulu");
    if (files.length > 5) return alert("Maks 5 file");

    // Dapatkan signed URL
    const res = await fetch("/api/admin/upload");
    const {
      timestamp,
      signature,
      apiKey,
      cloudName,
      folder,
      maxFileSize,
      allowedFormats,
    } = await res.json();

    const urls: string[] = [];

    for (const file of files) {
      if (file.size > maxFileSize)
        return alert(`ukuran ${file.name} terlalu besar`);
      if (
        !allowedFormats.includes(
          file.name.split(".").pop()?.toLowerCase() || "",
        )
      )
        return alert(`${file.name} format tidak didukung`);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", apiKey);
      formData.append("timestamp", timestamp.toString());
      formData.append("signature", signature);
      formData.append("folder", folder);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data: UploadResult = await uploadRes.json();
      urls.push(data.secure_url);
    }

    setUploadedUrls(urls);
    alert(`Upload selesai ${urls}!`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (uploadedUrls.length === 0)
      return alert("Upload gambar terlebih dahulu");

    const result = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        brand,
        processor: "intel",
        ram: "8 GB",
        storage: "256",
        price,
        stock: 20,
        status: "READY",
        images: [
          "https://res.cloudinary.com/dlswcoijv/image/upload/v1773712850/products/dcv6jamrsxvulcaxfy5o.webp",
        ],
      }),
    });

    console.log(await result.json(), '< ===')

    alert("Produk berhasil ditambahkan gan!");
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Nama Produk"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="text"
        placeholder="Brand"
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
      />
      <input
        type="number"
        placeholder="Price"
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
      />
      <input
        type="file"
        multiple
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
      />
      <button type="button" onClick={handleUpload}>
        Upload Images
      </button>
      <button type="submit">Submit Product</button>
    </form>
  );
}
