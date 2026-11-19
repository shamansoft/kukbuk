export function emailSignInError(error) {
  switch (error.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Invalid email or password. Please try again.";
    case "auth/user-not-found":
      return "Account not found. Please create an account on our website.";
    case "auth/invalid-email":
      return "Invalid email address format.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later.";
    default:
      return error.message || "Email/password sign-in failed";
  }
}
