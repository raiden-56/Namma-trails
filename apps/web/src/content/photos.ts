/**
 * Licensed photography. The Wikimedia Commons photos are CC0, public domain, CC BY or
 * CC BY-SA; the homepage hero photo is from Unsplash under the Unsplash License. Every
 * credit is shown on /photo-credits (required by CC BY / CC BY-SA, a courtesy for Unsplash).
 * Replace with commissioned photography when available.
 */
export interface PhotoCredit {
  title: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
}

export interface Photo {
  key: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  credit: PhotoCredit;
}

const list = [
  {
    "key": "gokarna-om-beach",
    "src": "/images/photos/gokarna-om-beach.jpg",
    "alt": "Om Beach, Gokarna: a curved bay seen from the headland",
    "width": 1600,
    "height": 900,
    "credit": {
      "title": "Om beach Gokarna.JPG",
      "author": "Axis of eran",
      "license": "CC0",
      "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Om_beach_Gokarna.JPG"
    }
  },
  {
    "key": "murudeshwar-shiva-statue",
    "src": "/images/photos/murudeshwar-shiva-statue.jpg",
    "alt": "The Shiva statue at Murudeshwar overlooking the Arabian Sea",
    "width": 1600,
    "height": 841,
    "credit": {
      "title": "Murudeshwar Shiva Statue.jpg",
      "author": "Joygopal008",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Murudeshwar_Shiva_Statue.jpg"
    }
  },
  {
    "key": "karwar-kali-river",
    "src": "/images/photos/karwar-kali-river.jpg",
    "alt": "The Kali river at Karwar at sunset",
    "width": 1600,
    "height": 1200,
    "credit": {
      "title": "Kali River as seen from sunset view point Karwar.jpg",
      "author": "Mayuri88",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Kali_River_as_seen_from_sunset_view_point_Karwar.jpg"
    }
  },
  {
    "key": "udupi-krishna-matha",
    "src": "/images/photos/udupi-krishna-matha.jpg",
    "alt": "Entrance of the Sri Krishna Matha, Udupi",
    "width": 1600,
    "height": 1200,
    "credit": {
      "title": "Udupi Sri Krishna Matha Temple.jpg",
      "author": "Ashok Prabhakaran from Chennai, India",
      "license": "CC BY-SA 2.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Udupi_Sri_Krishna_Matha_Temple.jpg"
    }
  },
  {
    "key": "karwar-beach",
    "src": "/images/photos/karwar-beach.jpg",
    "alt": "Fishing boats on the beach at Karwar",
    "width": 1600,
    "height": 1067,
    "credit": {
      "title": "A beach in Karwar, Uttara Kannada, India (2018).jpg",
      "author": "S0820A",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:A_beach_in_Karwar,_Uttara_Kannada,_India_(2018).jpg"
    }
  },
  {
    "key": "gokarna-koti-teertha",
    "src": "/images/photos/gokarna-koti-teertha.jpg",
    "alt": "Koti Teertha temple tank, Gokarna",
    "width": 1600,
    "height": 1067,
    "credit": {
      "title": "Gokarna, February, 2018-8.jpg",
      "author": "Alexey Komarov",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Gokarna,_February,_2018-8.jpg"
    }
  },
  {
    "key": "malpe-sunrise",
    "src": "/images/photos/malpe-sunrise.jpg",
    "alt": "Sunrise over the harbour at Malpe",
    "width": 1600,
    "height": 1198,
    "credit": {
      "title": "Sunrise at Malpe Beach.jpg",
      "author": "KshitizBathwal / Skyscape Photography",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Sunrise_at_Malpe_Beach.jpg"
    }
  },
  {
    "key": "kudle-beach-sunset",
    "src": "/images/photos/kudle-beach-sunset.jpg",
    "alt": "Sunset at Kudle Beach, Gokarna",
    "width": 1600,
    "height": 1067,
    "credit": {
      "title": "Sunset in the Arabian sea, Kudle Beach, Gokarna, Karnataka.jpg",
      "author": "Pranabandhu Nayak",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Sunset_in_the_Arabian_sea,_Kudle_Beach,_Gokarna,_Karnataka.jpg"
    }
  },
  {
    "key": "boat-ride-sunset",
    "src": "/images/photos/boat-ride-sunset.jpg",
    "alt": "A boat heading out at sunset off Gokarna",
    "width": 1600,
    "height": 1065,
    "credit": {
      "title": "Go Fisherman go - Gokarna India 2011 - Flickr - rundenreisen.org.jpg",
      "author": "Andreas Lehner from Berlin, Germany",
      "license": "CC BY 2.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Go_Fisherman_go_-_Gokarna_India_2011_-_Flickr_-_rundenreisen.org.jpg"
    }
  },
  {
    "key": "kayaks-riverbank",
    "src": "/images/photos/kayaks-riverbank.jpg",
    "alt": "Kayaks on a riverbank in Karnataka",
    "width": 1600,
    "height": 1200,
    "credit": {
      "title": "Kayakers near river bank.jpg",
      "author": "Sushantt2099",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Kayakers_near_river_bank.jpg"
    }
  },
  {
    "key": "scooter",
    "src": "/images/photos/scooter.jpg",
    "alt": "A scooter parked outside a house",
    "width": 1600,
    "height": 1200,
    "credit": {
      "title": "TVS Jupiter Scooter.jpg",
      "author": "SnapMeUp",
      "license": "CC BY 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by/4.0",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:TVS_Jupiter_Scooter.jpg"
    }
  },
  {
    "key": "nh66-kapu",
    "src": "/images/photos/nh66-kapu.jpg",
    "alt": "National Highway 66 near Kapu",
    "width": 1600,
    "height": 1200,
    "credit": {
      "title": "NH 66 at Kapu.jpg",
      "author": "Shaymmm",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:NH_66_at_Kapu.jpg"
    }
  },
  {
    "key": "yana-rocks",
    "src": "/images/photos/yana-rocks.jpg",
    "alt": "The Yana rock formations in the Western Ghats",
    "width": 1600,
    "height": 900,
    "credit": {
      "title": "Yana Rocks Karnataka India.jpg",
      "author": "Photos Worldwide",
      "license": "CC0",
      "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Yana_Rocks_Karnataka_India.jpg"
    }
  },
  {
    "key": "mirjan-fort",
    "src": "/images/photos/mirjan-fort.jpg",
    "alt": "The ramparts of Mirjan Fort, Uttara Kannada",
    "width": 1600,
    "height": 900,
    "credit": {
      "title": "MIRJAN FORT 03.jpg",
      "author": "Nagamani L E",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:MIRJAN_FORT_03.jpg"
    }
  },
  {
    "key": "yakshagana",
    "src": "/images/photos/yakshagana.jpg",
    "alt": "A Yakshagana performer on stage",
    "width": 1600,
    "height": 1067,
    "credit": {
      "title": "Yakshagana 12398.jpg",
      "author": "Vandana bhat kaustubha",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Yakshagana_12398.jpg"
    }
  },
  {
    "key": "homestay-veranda",
    "src": "/images/photos/homestay-veranda.jpg",
    "alt": "The veranda of a homestay in Karnataka",
    "width": 1600,
    "height": 1200,
    "credit": {
      "title": "Homestay, Coorg, Karnataka.jpg",
      "author": "psubhashish",
      "license": "CC BY-SA 3.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Homestay,_Coorg,_Karnataka.jpg"
    }
  },
  {
    "key": "gokarna-headland-blue-sky",
    "src": "/images/photos/gokarna-headland-blue-sky.jpg",
    "alt": "A green headland and a blue bay at Gokarna under a bright sky",
    "width": 2400,
    "height": 1800,
    "credit": {
      "title": "A view of a body of water from a hill",
      "author": "Tirth Jivani",
      "license": "Unsplash License",
      "licenseUrl": "https://unsplash.com/license",
      "sourceUrl": "https://unsplash.com/photos/a-view-of-a-body-of-water-from-a-hill-Z9CnSmEFWiE"
    }
  }
] as const satisfies readonly Photo[];

export type PhotoKey = (typeof list)[number]["key"];
export const photos: readonly Photo[] = list;
export const photo = (key: PhotoKey): Photo => list.find((p) => p.key === key)!;
