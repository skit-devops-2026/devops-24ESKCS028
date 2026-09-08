var currentPage = window.location.pathname;

function base64UrlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  return decodeURIComponent(escape(atob(str)));
}

function createJwtToken(user) {
  var header = {
    alg: "HS256",
    typ: "JWT"
  };

  var now = Math.floor(Date.now() / 1000);
  var payload = {
    sub: user.username,
    name: user.name,
    crop: user.crop,
    joinedDate: user.joinedDate,
    iat: now,
    exp: now + (24 * 60 * 60)
  };

  var encodedHeader = base64UrlEncode(JSON.stringify(header));
  var encodedPayload = base64UrlEncode(JSON.stringify(payload));
  var signature = base64UrlEncode("krishi_signature_key_" + encodedHeader + "." + encodedPayload);

  return encodedHeader + "." + encodedPayload + "." + signature;
}

function verifyAndDecodeJwt(token) {
  if (!token) {
    return null;
  }

  var parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    var payload = JSON.parse(base64UrlDecode(parts[1]));
    var now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

function isLoginPage() {
  return currentPage.includes("login.html");
}

function isRegisterPage() {
  return currentPage.includes("register.html");
}

function isProfilePage() {
  return currentPage.includes("profile.html");
}

function isHomePage() {
  return currentPage.includes("index.html") || currentPage === "/" || currentPage.endsWith("/");
}

function getLoggedInUser() {
  var token = localStorage.getItem("krishiAuthToken");
  return verifyAndDecodeJwt(token);
}

function getAllUsers() {
  var users = localStorage.getItem("krishiUsers");
  if (users) {
    return JSON.parse(users);
  }
  return [];
}

function saveAllUsers(users) {
  localStorage.setItem("krishiUsers", JSON.stringify(users));
}

$(document).ready(function () {

  var loggedInUser = getLoggedInUser();

  if (isProfilePage()) {
    if (!loggedInUser) {
      window.location.href = "login.html";
      return;
    }
    loadProfilePage(loggedInUser);
  }

  if (isHomePage()) {
    if (!loggedInUser) {
      window.location.href = "login.html";
      return;
    }
  }

  if ((isLoginPage() || isRegisterPage()) && loggedInUser) {
    window.location.href = "index.html";
    return;
  }

  if (isRegisterPage()) {
    $("#registerBtn").on("click", function () {
      var name = $("#regName").val().trim();
      var username = $("#regUsername").val().trim();
      var password = $("#regPassword").val().trim();
      var crop = $("#regCrop").val();

      if (!name || !username || !password) {
        $("#registerError").text("Please fill in all required fields.").show();
        return;
      }

      if (username.length < 3) {
        $("#registerError").text("Username must be at least 3 characters.").show();
        return;
      }

      if (password.length < 4) {
        $("#registerError").text("Password must be at least 4 characters.").show();
        return;
      }

      var users = getAllUsers();
      var existingUser = null;
      for (var i = 0; i < users.length; i++) {
        if (users[i].username.toLowerCase() === username.toLowerCase()) {
          existingUser = users[i];
          break;
        }
      }

      if (existingUser) {
        $("#registerError").text("This username is already taken. Please choose another.").show();
        return;
      }

      var newUser = {
        name: name,
        username: username,
        password: password,
        crop: crop || "Not specified",
        joinedDate: new Date().toLocaleDateString("en-IN")
      };

      users.push(newUser);
      saveAllUsers(users);

      $("#registerError").hide();
      $("#registerSuccess").text("Account created successfully. Redirecting to login...").show();

      setTimeout(function () {
        window.location.href = "login.html";
      }, 1200);
    });
  }

  if (isLoginPage()) {
    $("#loginBtn").on("click", function () {
      var username = $("#loginUsername").val().trim();
      var password = $("#loginPassword").val().trim();

      if (!username || !password) {
        $("#loginError").text("Please enter both username and password.").show();
        return;
      }

      var users = getAllUsers();
      var matchedUser = null;
      for (var i = 0; i < users.length; i++) {
        if (users[i].username.toLowerCase() === username.toLowerCase() && users[i].password === password) {
          matchedUser = users[i];
          break;
        }
      }

      if (!matchedUser) {
        $("#loginError").text("Wrong username or password. Please try again.").show();
        return;
      }

      var token = createJwtToken(matchedUser);
      localStorage.setItem("krishiAuthToken", token);

      window.location.href = "index.html";
    });
  }

  if (isProfilePage()) {
    $("#logoutBtn").on("click", function (e) {
      e.preventDefault();
      localStorage.removeItem("krishiAuthToken");
      window.location.href = "login.html";
    });
  }

});

function loadProfilePage(user) {
  var initials = user.name.split(" ").map(function (word) {
    return word.charAt(0);
  }).join("").toUpperCase().substring(0, 2);

  $("#profileAvatar").text(initials || "K");
  $("#profileName").text(user.name);
  $("#profileUsername").text(user.sub);
  $("#profileCrop").text(user.crop);
  $("#profileDate").text(user.joinedDate);

  var history = JSON.parse(localStorage.getItem("krishiHistory") || "[]");
  if (history.length === 0) {
    $("#profileHistory").html('<p class="no-history">You have not scanned any plants yet. <a href="index.html">Scan now</a></p>');
  } else {
    var html = "";
    for (var i = 0; i < history.length; i++) {
      html += "<div class='history-item'>";
      html += "<div class='history-crop'>" + history[i].crop + "</div>";
      html += "<div class='history-time'>" + history[i].time + "</div>";
      html += "<div class='history-result'>" + history[i].result + "</div>";
      html += "</div>";
    }
    $("#profileHistory").html(html);
  }
}
