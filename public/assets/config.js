// Dükkan bilgileri — sadece burayı değiştirmeniz yeterli, site ve panel buradan okur.
window.DUKKAN = {
  ad: "Tek Halı Yıkama",
  slogan: "Kalitenin Adresi",
  telefon: "+90 554 629 17 76",
  telefon2: "+90 538 545 15 91", // ikinci arama numarası (istemezseniz "" yapın)
  whatsapp: "905546291776", // WhatsApp'ın kayıtlı olduğu numara: başında + olmadan, ülke koduyla
  adres: "Doğu Mahallesi, Hatboyu Caddesi, No: 94/C, Pendik / İstanbul",

  // Fiyat listeleri (₺). birim: "m²", "adet", "takım" gibi yazılabilir.
  fiyatlar: {
    // "Randevu Al" — adresten alım ve geri teslim
    randevu: [
      { ad: "Makina halısı", fiyat: 140, birim: "m²" },
      { ad: "Shaggy", fiyat: 150, birim: "m²" },
      { ad: "Yün halı", fiyat: 300, birim: "m²" },
      { ad: "Yorgan", fiyat: 750, birim: "m²" },
      { ad: "Battaniye", fiyat: 500, birim: "m²" },
      { ad: "Stor & zebra", fiyat: 150, birim: "m²" },
      { ad: "Koltuk yıkama", fiyat: 3500, birim: "m²" },
    ],
    // "Kendim Bırakacağım" — dükkana getirip alana
    dukkan: [
      { ad: "Makina halısı", fiyat: 80, birim: "m²" },
      { ad: "Shaggy", fiyat: 100, birim: "m²" },
      { ad: "Yün halı", fiyat: 150, birim: "m²" },
      { ad: "Yorgan", fiyat: 600, birim: "m²" },
      { ad: "Battaniye", fiyat: 400, birim: "m²" },
      { ad: "Stor & zebra", fiyat: 100, birim: "m²" },
    ],
  },
};
