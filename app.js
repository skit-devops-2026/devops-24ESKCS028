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
});
