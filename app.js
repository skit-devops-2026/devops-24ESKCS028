var GROQ_API_KEY = atob("Z3NrXzE1RjVqYnBreEQ4eFJqb2FZNjR0V0dkeWIzRll1aUxGUVZhbHRKTGVacjRkUFlZU21tYw==");
var selectedImageBase64 = "";

$(document).ready(function () {
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
    $("#resultBox").html("Analyzing your plant...");

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
              { type: "text", text: message },
              { type: "image_url", image_url: { url: "data:image/jpeg;base64," + selectedImageBase64 } }
            ]
          }
        ],
        max_tokens: 800
      }),
      success: function (data) {
        var reply = data.choices[0].message.content;
        $("#resultBox").html(reply);
      }
    });
  });
});
