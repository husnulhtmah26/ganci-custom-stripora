// Script untuk upload desain ke Cloudinary (unsigned) lalu menyimpan pesanan ke file orders.json di GitHub repo
// === CONFIG ===
// isi variabel berikut sebelum dipakai:
const CLOUDINARY_CLOUD_NAME = "dljfdauc5"; 
const CLOUDINARY_UPLOAD_PRESET = "stripora_unsigned"; 
const GITHUB_OWNER = "husnulhtmah26"; 
const GITHUB_REPO = "ganci-custom-stripora"; 
const GITHUB_BRANCH = "main"; 
const GITHUB_FILEPATH = "orders.json"; 
const GITHUB_TOKEN = "pasword-gogle";

// ----------------------
// helper
async function uploadToCloudinary(file) {
  if (!file) return null;
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  try {
    const res = await fetch(url, { method: "POST", body: form });
    if (!res.ok) throw new Error("Gagal upload ke Cloudinary");
    const data = await res.json();
    return data.secure_url;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function getGitHubFileSha(owner, repo, path, branch, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" } });
  if (res.status === 200) {
    const j = await res.json();
    return j.sha;
  } else if (res.status === 404) {
    return null; // file belum ada
  } else {
    const txt = await res.text();
    throw new Error("Gagal baca file GitHub: " + txt);
  }
}

async function saveOrderToGitHub(order) {
  // convert to utf8 and base64
  const owner = GITHUB_OWNER;
  const repo = GITHUB_REPO;
  const path = GITHUB_FILEPATH;
  const branch = GITHUB_BRANCH;
  const token = GITHUB_TOKEN;
  if (!token || token.includes("GITHUB_PERSONAL_ACCESS_TOKEN")) {
    throw new Error("GITHUB_TOKEN belum diisi di script.js");
  }
  // get existing sha
  const sha = await getGitHubFileSha(owner, repo, path, branch, token);
  let existing = [];
  if (sha) {
    // ambil isi file
    const urlGet = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
    const resGet = await fetch(urlGet, { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" } });
    if (!resGet.ok) throw new Error("Gagal mengambil file lama dari GitHub");
    const j = await resGet.json();
    const content = atob(j.content.replace(/\n/g, ""));
    existing = JSON.parse(content || "[]");
  }
  existing.push(order);
  const newContent = btoa(unescape(encodeURIComponent(JSON.stringify(existing, null, 2))));
  // create/update file
  const urlPut = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body = {
    message: `Add order from ${order.name} (${new Date().toISOString()})`,
    content: newContent,
    branch: branch
  };
  if (sha) body.sha = sha;
  const res = await fetch(urlPut, { 
    method: "PUT",
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error("Gagal menyimpan ke GitHub: " + txt);
  }
  return await res.json();
}

// Form handling
const form = document.getElementById("orderForm");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submitBtn");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.textContent = "⏳ Mengirim pesanan...";
  submitBtn.disabled = true;
  try {
    const fileInput = document.getElementById("design");
    const file = fileInput.files[0];
    let imageUrl = null;
    if (file) {
      imageUrl = await uploadToCloudinary(file);
    }
    const order = {
      name: document.getElementById("name").value.trim(),
      whatsapp: document.getElementById("whatsapp").value.trim(),
      material: document.getElementById("material").value,
      qty: Number(document.getElementById("qty").value),
      note: document.getElementById("note").value.trim(),
      image: imageUrl,
      date: new Date().toISOString()
    };
    // Save to GitHub
    await saveOrderToGitHub(order);
    statusEl.textContent = "✅ Pesanan berhasil disimpan! (tersimpan di orders.json)";
    form.reset();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "❌ Gagal mengirim pesanan: " + (err.message || err);
  } finally {
    submitBtn.disabled = false;
  }
});
