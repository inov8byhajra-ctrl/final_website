const V = {
  name(v, label = 'Name') {
    v = v.trim().replace(/\s+/g, ' ');
    if (v.length < 2) return label + ' must be at least 2 letters.';
    if (v.length > 60) return label + ' must be 60 characters or less.';
    if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(v)) return label + ' can only contain letters and spaces. Numbers and symbols are not allowed.';
    return '';
  },
  company(v) {
    v = v.trim();
    return /^[A-Za-z0-9][A-Za-z0-9 &.,'()\-]{1,99}$/.test(v) ? '' : "Company name must be 2-100 characters (letters, numbers, & . , ' ( ) - only).";
  },
  license(v) {
    v = v.trim();
    if (v.includes('@')) return 'License number cannot be an email address or contain "@". Enter the number printed on your trade license.';
    if (/\s/.test(v)) return 'License number cannot contain spaces.';
    return /^[A-Z0-9][A-Z0-9\-/]{3,39}$/.test(v.toUpperCase()) ? '' : 'License number must be 4-40 characters: letters, numbers, - or / only.';
  },
  email(v) {
    v = v.trim();
    if (!v) return 'Please enter your email address.';
    return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v) ? '' : 'Please enter a valid email address (e.g. name@company.com).';
  },
  password(p) {
    if (p.length < 8) return 'Password must be at least 8 characters long.';
    if (new TextEncoder().encode(p).length > 72) return 'Password is too long (max 72 characters).';
    if (/\s/.test(p)) return 'Password cannot contain spaces.';
    if (!/[A-Z]/.test(p)) return 'Password must contain at least one UPPERCASE letter (A-Z).';
    if (!/\d/.test(p)) return 'Password must contain at least one number (0-9).';
    if (!/[@$!%*?&]/.test(p)) return 'Password must contain at least one symbol: @ $ ! % * ? &';
    return '';
  },
  /* blocks digits/symbols while typing (also on paste) */
  lettersOnly(input) {
    input.maxLength = 60;
    input.addEventListener('input', () => { input.value = input.value.replace(/[^A-Za-z ]/g, '').replace(/ {2,}/g, ' ') });
  }
};