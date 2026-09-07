var GROQ_API_KEY = atob("Z3NrXzE1RjVqYnBreEQ4eFJqb2FZNjR0V0dkeWIzRll1aUxGUVZhbHRKTGVacjRkUFlZU21tYw==");

var selectedImageBase64 = "";

$(document).ready(function () {

  $("#navLogoutBtn").on("click", function (e) {
    e.preventDefault();
    localStorage.removeItem("krishiAuthToken");
    localStorage.removeItem("krishiLoggedInUser");
    window.location.href = "login.html";
  });

  $("#leafPhoto").on("change", function () {
    var file = this.files[0];
    if (file) {
      var reader = new FileReader();
      reader.onload = function (e) {
        selectedImageBase64 = e.target.result.split(",")[1];
        $("#previewImg").attr("src", e.target.result);
        $("#previewArea").show();
        $("#uploadBox").hide();
      };
      reader.readAsDataURL(file);
    }
  });

  $("#removeBtn").on("click", function () {
    selectedImageBase64 = "";
    $("#previewImg").attr("src", "");
    $("#previewArea").hide();
    $("#uploadBox").show();
    $("#leafPhoto").val("");
  });

  $("#analyzeBtn").on("click", function () {
    if (!selectedImageBase64) {
      alert("Please upload a photo of your leaf first.");
      return;
    }

    var crop = $("#cropName").val();
    var extra = $("#extraInfo").val();

    var message = "I am a farmer. I have uploaded a photo of a plant leaf.";
    if (crop) {
      message += " The crop is " + crop + ".";
    }
    if (extra) {
      message += " Extra details: " + extra + ".";
    }
    message += " Please look at this leaf image and tell me: 1) What disease does the plant have? 2) Why does this happen? 3) What should I do to fix it? Please reply in simple English so a farmer can understand easily.";

    $("#resultSection").show();
    $("#loadingMsg").show();
    $("#resultBox").html("");
    $("#analyzeBtn").prop("disabled", true);

    $.ajax({
      url: "https://api.groq.com/openai/v1/chat/completions",
      type: "POST",
      contentType: "application/json",
      headers: {
        "Authorization": "Bearer " + GROQ_API_KEY
      },
      data: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: message
              },
              {
                type: "image_url",
                image_url: {
                  url: "data:image/jpeg;base64," + selectedImageBase64
                }
              }
            ]
          }
        ],
        max_tokens: 800
      }),
      success: function (data) {
        $("#loadingMsg").hide();
        var reply = data.choices[0].message.content;
        $("#resultBox").html(reply);
        $("#analyzeBtn").prop("disabled", false);

        var cropName = $("#cropName").val() || "Unknown Crop";
        var now = new Date().toLocaleString("en-IN");
        var historyItem = {
          crop: cropName,
          time: now,
          result: reply.substring(0, 150) + "..."
        };

        var history = JSON.parse(localStorage.getItem("krishiHistory") || "[]");
        history.unshift(historyItem);
        if (history.length > 5) {
          history = history.slice(0, 5);
        }
        localStorage.setItem("krishiHistory", JSON.stringify(history));
        showHistory();
      },
      error: function (xhr) {
        $("#loadingMsg").hide();
        var errorMsg = "Something went wrong. Please check your internet connection.";
        if (xhr.responseJSON && xhr.responseJSON.error) {
          errorMsg = xhr.responseJSON.error.message;
        }
        $("#resultBox").html("<div class='error-box'>Error: " + errorMsg + "</div>");
        $("#analyzeBtn").prop("disabled", false);
      }
    });
  });

  showHistory();

  $("#clearHistoryBtn").on("click", function () {
    localStorage.removeItem("krishiHistory");
    showHistory();
  });

});

function showHistory() {
  var history = JSON.parse(localStorage.getItem("krishiHistory") || "[]");
  if (history.length === 0) {
    $("#historySection").hide();
    return;
  }
  $("#historySection").show();
  var html = "";
  for (var i = 0; i < history.length; i++) {
    html += "<div class='history-item'>";
    html += "<div class='history-crop'>" + history[i].crop + "</div>";
    html += "<div class='history-time'>" + history[i].time + "</div>";
    html += "<div class='history-result'>" + history[i].result + "</div>";
    html += "</div>";
  }
  $("#historyList").html(html);
}
