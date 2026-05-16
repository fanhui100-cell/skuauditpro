const form = document.querySelector("#contact-form");
const note = document.querySelector("#contact-note");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  note.textContent = "正在提交...";

  const payload = {
    name: document.querySelector("#contact-name").value.trim(),
    contact: document.querySelector("#contact-detail").value.trim(),
    platform: document.querySelector("#contact-platform").value,
    skuCount: "",
    pain: document.querySelector("#contact-message").value.trim(),
    source: "contact-page",
  };

  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("提交失败");
    }

    const data = await response.json();
    form.reset();
    if (data.lead?.reportId) {
      const reportUrl = `${window.location.origin}/report.html?id=${encodeURIComponent(data.lead.reportId)}`;
      note.innerHTML = `已提交。报告编号：${data.lead.reportId}，可在 <a href="${reportUrl}" target="_blank" rel="noreferrer">报告查询页</a> 查看进度。`;
    } else {
      note.textContent = "已提交。我们会根据你留下的联系方式跟进。";
    }
  } catch {
    note.textContent = "暂时无法提交，请稍后再试或直接发送邮件。";
  }
});
