export const countries = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda',
  'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain',
  'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan',
  'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria',
  'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada', 'Cape Verde',
  'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
  'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic',
  'Democratic Republic of the Congo', 'Denmark', 'Djibouti', 'Dominica',
  'Dominican Republic', 'East Timor', 'Ecuador', 'Egypt', 'El Salvador',
  'Equatorial Guinea', 'Eritrea', 'Estonia', 'Ethiopia', 'Fiji', 'Finland',
  'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada',
  'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary',
  'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati',
  'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia',
  'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi',
  'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania',
  'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia',
  'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal',
  'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea',
  'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama',
  'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
  'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore',
  'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea',
  'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland',
  'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Togo', 'Tonga',
  'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda',
  'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay',
  'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen',
  'Zambia', 'Zimbabwe'
];

export const locationsByCountry: Record<string, string[]> = {
  'United States': [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
    'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
    'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
    'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
    'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
    'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
    'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
    'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
    'West Virginia', 'Wisconsin', 'Wyoming'
  ],
  'Canada': [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
    'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia',
    'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan',
    'Yukon'
  ],
  'United Kingdom': [
    'England', 'Scotland', 'Wales', 'Northern Ireland', 'London',
    'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Edinburgh',
    'Liverpool', 'Bristol', 'Sheffield', 'Newcastle', 'Cardiff'
  ],
  'Australia': [
    'New South Wales', 'Victoria', 'Queensland', 'Western Australia',
    'South Australia', 'Tasmania', 'Australian Capital Territory',
    'Northern Territory', 'Sydney', 'Melbourne', 'Brisbane', 'Perth',
    'Adelaide', 'Canberra'
  ],
  'Germany': [
    'Baden-Württemberg', 'Bavaria', 'Berlin', 'Brandenburg', 'Bremen',
    'Hamburg', 'Hesse', 'Lower Saxony', 'Mecklenburg-Vorpommern',
    'North Rhine-Westphalia', 'Rhineland-Palatinate', 'Saarland',
    'Saxony', 'Saxony-Anhalt', 'Schleswig-Holstein', 'Thuringia',
    'Munich', 'Frankfurt', 'Cologne', 'Stuttgart', 'Düsseldorf'
  ],
  'France': [
    'Île-de-France', 'Auvergne-Rhône-Alpes', 'Provence-Alpes-Côte d\'Azur',
    'Nouvelle-Aquitaine', 'Occitanie', 'Hauts-de-France', 'Brittany',
    'Normandy', 'Grand Est', 'Pays de la Loire', 'Centre-Val de Loire',
    'Bourgogne-Franche-Comté', 'Paris', 'Lyon', 'Marseille', 'Toulouse',
    'Nice', 'Nantes', 'Bordeaux'
  ],
  'India': [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune'
  ],
  'China': [
    'Beijing', 'Shanghai', 'Guangdong', 'Zhejiang', 'Jiangsu', 'Shandong',
    'Sichuan', 'Henan', 'Hubei', 'Fujian', 'Hunan', 'Anhui', 'Hebei',
    'Liaoning', 'Shaanxi', 'Guangxi', 'Yunnan', 'Jiangxi', 'Chongqing',
    'Tianjin', 'Shenzhen', 'Chengdu', 'Wuhan', 'Hangzhou', 'Xi\'an', 'Nanjing'
  ],
  'Brazil': [
    'São Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Bahia', 'Paraná',
    'Rio Grande do Sul', 'Pernambuco', 'Ceará', 'Pará', 'Santa Catarina',
    'Goiás', 'Maranhão', 'Amazonas', 'Espírito Santo', 'Brasília',
    'Salvador', 'Fortaleza', 'Belo Horizonte', 'Manaus', 'Curitiba',
    'Recife', 'Porto Alegre'
  ],
  'Japan': [
    'Tokyo', 'Osaka', 'Kanagawa', 'Aichi', 'Saitama', 'Chiba', 'Hyogo',
    'Hokkaido', 'Fukuoka', 'Kyoto', 'Shizuoka', 'Hiroshima', 'Ibaraki',
    'Miyagi', 'Nagano', 'Niigata', 'Yokohama', 'Nagoya', 'Sapporo', 'Kobe'
  ],
  'Mexico': [
    'Mexico City', 'Jalisco', 'Nuevo León', 'Puebla', 'Guanajuato',
    'Chiapas', 'Veracruz', 'Baja California', 'Michoacán', 'Oaxaca',
    'Chihuahua', 'Tamaulipas', 'Guerrero', 'Guadalajara', 'Monterrey',
    'Puebla City', 'Tijuana', 'León', 'Juárez'
  ],
  'Spain': [
    'Madrid', 'Catalonia', 'Andalusia', 'Valencia', 'Basque Country',
    'Galicia', 'Castile and León', 'Castilla-La Mancha', 'Aragon',
    'Canary Islands', 'Murcia', 'Asturias', 'Balearic Islands',
    'Barcelona', 'Valencia', 'Seville', 'Bilbao', 'Málaga', 'Zaragoza'
  ],
  'Italy': [
    'Lazio', 'Lombardy', 'Campania', 'Sicily', 'Veneto', 'Piedmont',
    'Emilia-Romagna', 'Apulia', 'Tuscany', 'Calabria', 'Sardinia',
    'Liguria', 'Rome', 'Milan', 'Naples', 'Turin', 'Palermo', 'Genoa',
    'Bologna', 'Florence', 'Venice'
  ],
  'Netherlands': [
    'North Holland', 'South Holland', 'North Brabant', 'Gelderland',
    'Utrecht', 'Limburg', 'Overijssel', 'Friesland', 'Groningen',
    'Drenthe', 'Flevoland', 'Zeeland', 'Amsterdam', 'Rotterdam',
    'The Hague', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen'
  ],
  'South Africa': [
    'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape',
    'Limpopo', 'Mpumalanga', 'North West', 'Free State', 'Northern Cape',
    'Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth',
    'Bloemfontein'
  ],
  'Argentina': [
    'Buenos Aires', 'Córdoba', 'Santa Fe', 'Mendoza', 'Tucumán',
    'Entre Ríos', 'Salta', 'Chaco', 'Corrientes', 'Misiones',
    'Buenos Aires City', 'Córdoba City', 'Rosario', 'La Plata', 'Mar del Plata'
  ],
  'Nigeria': [
    'Lagos', 'Kano', 'Kaduna', 'Ibadan', 'Port Harcourt', 'Benin City',
    'Abuja', 'Jos', 'Ilorin', 'Oyo', 'Enugu', 'Abia', 'Ondo', 'Osun'
  ],
  'Poland': [
    'Masovian', 'Silesian', 'Lesser Poland', 'Greater Poland', 'Lower Silesian',
    'Pomeranian', 'Łódź', 'West Pomeranian', 'Lublin', 'Warsaw', 'Kraków',
    'Łódź', 'Wrocław', 'Poznań', 'Gdańsk'
  ],
  'South Korea': [
    'Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju', 'Ulsan',
    'Gyeonggi', 'North Gyeongsang', 'South Gyeongsang', 'North Jeolla',
    'South Jeolla', 'Gangwon', 'North Chungcheong', 'South Chungcheong'
  ],
  'Sweden': [
    'Stockholm', 'Västra Götaland', 'Skåne', 'Östergötland', 'Uppsala',
    'Södermanland', 'Halland', 'Örebro', 'Jönköping', 'Västmanland',
    'Gothenburg', 'Malmö', 'Uppsala City'
  ],
  'Switzerland': [
    'Zürich', 'Bern', 'Vaud', 'Aargau', 'St. Gallen', 'Geneva', 'Lucerne',
    'Ticino', 'Valais', 'Fribourg', 'Basel-Stadt', 'Basel-Landschaft',
    'Geneva City', 'Lausanne', 'Basel', 'Bern City'
  ],
  'Singapore': ['Central Region', 'East Region', 'North Region', 'North-East Region', 'West Region'],
  'New Zealand': [
    'Auckland', 'Wellington', 'Canterbury', 'Waikato', 'Bay of Plenty',
    'Otago', 'Manawatu-Wanganui', 'Hawke\'s Bay', 'Northland', 'Taranaki',
    'Christchurch', 'Hamilton', 'Tauranga', 'Dunedin'
  ],
  'Ireland': [
    'Dublin', 'Cork', 'Galway', 'Limerick', 'Waterford', 'Leinster',
    'Munster', 'Connacht', 'Ulster'
  ],
  'Belgium': [
    'Flanders', 'Wallonia', 'Brussels', 'Antwerp', 'East Flanders',
    'Flemish Brabant', 'Limburg', 'West Flanders', 'Hainaut', 'Liège',
    'Luxembourg', 'Namur', 'Walloon Brabant', 'Ghent', 'Charleroi', 'Bruges'
  ],
  'Austria': [
    'Vienna', 'Lower Austria', 'Upper Austria', 'Styria', 'Tyrol',
    'Carinthia', 'Salzburg', 'Vorarlberg', 'Burgenland', 'Graz',
    'Linz', 'Salzburg City', 'Innsbruck'
  ],
  'Norway': [
    'Oslo', 'Viken', 'Vestland', 'Rogaland', 'Trøndelag', 'Innlandet',
    'Møre og Romsdal', 'Nordland', 'Agder', 'Vestfold og Telemark',
    'Troms og Finnmark', 'Bergen', 'Trondheim', 'Stavanger'
  ],
  'Denmark': [
    'Capital Region', 'Zealand', 'Southern Denmark', 'Central Denmark',
    'North Denmark', 'Copenhagen', 'Aarhus', 'Odense', 'Aalborg'
  ],
  'Finland': [
    'Uusimaa', 'Pirkanmaa', 'Southwest Finland', 'North Ostrobothnia',
    'Central Finland', 'Lapland', 'Kanta-Häme', 'Päijät-Häme',
    'Helsinki', 'Espoo', 'Tampere', 'Vantaa', 'Oulu', 'Turku'
  ],
  'Portugal': [
    'Lisbon', 'Porto', 'Setúbal', 'Braga', 'Aveiro', 'Faro', 'Coimbra',
    'Leiria', 'Santarém', 'Viseu', 'Porto City', 'Braga City', 'Funchal'
  ],
  'Turkey': [
    'Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Konya',
    'Gaziantep', 'Şanlıurfa', 'Kocaeli', 'Mersin', 'Diyarbakır', 'Hatay'
  ],
  'United Arab Emirates': [
    'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah',
    'Fujairah', 'Umm Al Quwain'
  ],
  'Saudi Arabia': [
    'Riyadh', 'Makkah', 'Eastern Province', 'Medina', 'Asir', 'Qassim',
    'Tabuk', 'Jazan', 'Najran', 'Jeddah', 'Dammam', 'Khobar'
  ],
  'Egypt': [
    'Cairo', 'Alexandria', 'Giza', 'Sharkia', 'Dakahlia', 'Beheira',
    'Minya', 'Qalyubia', 'Gharbia', 'Asyut', 'Ismailia', 'Luxor', 'Aswan'
  ],
  'Pakistan': [
    'Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad',
    'Karachi', 'Lahore', 'Faisalabad', 'Rawalpindi', 'Multan', 'Peshawar',
    'Quetta', 'Hyderabad'
  ],
  'Bangladesh': [
    'Dhaka', 'Chittagong', 'Khulna', 'Rajshahi', 'Sylhet', 'Barisal',
    'Rangpur', 'Mymensingh', 'Dhaka City', 'Chittagong City', 'Sylhet City'
  ],
  'Philippines': [
    'Metro Manila', 'Cebu', 'Davao', 'Calabarzon', 'Central Luzon',
    'Western Visayas', 'Central Visayas', 'Zamboanga Peninsula',
    'Northern Mindanao', 'Manila', 'Quezon City', 'Makati', 'Cebu City',
    'Davao City'
  ],
  'Thailand': [
    'Bangkok', 'Chiang Mai', 'Nonthaburi', 'Pathum Thani', 'Phuket',
    'Chon Buri', 'Khon Kaen', 'Nakhon Ratchasima', 'Udon Thani', 'Samut Prakan'
  ],
  'Indonesia': [
    'Jakarta', 'West Java', 'East Java', 'Central Java', 'Banten',
    'North Sumatra', 'South Sulawesi', 'Bali', 'West Sumatra', 'Lampung',
    'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar'
  ],
  'Malaysia': [
    'Selangor', 'Johor', 'Sabah', 'Sarawak', 'Perak', 'Penang', 'Pahang',
    'Kedah', 'Negeri Sembilan', 'Kelantan', 'Kuala Lumpur', 'Putrajaya',
    'George Town', 'Ipoh', 'Johor Bahru'
  ],
  'Vietnam': [
    'Hanoi', 'Ho Chi Minh City', 'Da Nang', 'Haiphong', 'Can Tho',
    'Binh Duong', 'Dong Nai', 'Ba Ria-Vung Tau', 'Khanh Hoa', 'Lam Dong'
  ],
  'Chile': [
    'Santiago', 'Valparaíso', 'Biobío', 'Maule', 'La Araucanía',
    'Los Lagos', 'O\'Higgins', 'Coquimbo', 'Antofagasta', 'Viña del Mar',
    'Concepción', 'Valparaíso City'
  ],
  'Colombia': [
    'Bogotá', 'Antioquia', 'Valle del Cauca', 'Atlántico', 'Santander',
    'Bolívar', 'Cundinamarca', 'Norte de Santander', 'Tolima', 'Medellín',
    'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga'
  ],
  'Peru': [
    'Lima', 'Arequipa', 'La Libertad', 'Piura', 'Lambayeque', 'Cusco',
    'Junín', 'Puno', 'Cajamarca', 'Lima City', 'Arequipa City', 'Trujillo',
    'Chiclayo', 'Cusco City'
  ],
  'Kenya': [
    'Nairobi', 'Mombasa', 'Kiambu', 'Nakuru', 'Machakos', 'Kisumu',
    'Uasin Gishu', 'Kakamega', 'Meru', 'Kilifi'
  ],
  'Ghana': [
    'Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Central', 'Northern',
    'Volta', 'Brong-Ahafo', 'Accra', 'Kumasi', 'Tamale', 'Sekondi-Takoradi'
  ],
  'Israel': [
    'Tel Aviv', 'Jerusalem', 'Haifa', 'Rishon LeZion', 'Petah Tikva',
    'Ashdod', 'Netanya', 'Beersheba', 'Holon', 'Bnei Brak'
  ],
  'Greece': [
    'Attica', 'Central Macedonia', 'Thessaly', 'Crete', 'Western Greece',
    'Eastern Macedonia and Thrace', 'Peloponnese', 'Athens', 'Thessaloniki',
    'Patras', 'Heraklion'
  ],
  'Czech Republic': [
    'Prague', 'South Moravian', 'Moravian-Silesian', 'Central Bohemian',
    'Olomouc', 'Zlín', 'Pilsen', 'South Bohemian', 'Brno', 'Ostrava', 'Pilsen City'
  ],
  'Romania': [
    'Bucharest', 'Ilfov', 'Cluj', 'Timiș', 'Iași', 'Constanța', 'Brașov',
    'Prahova', 'Galați', 'Cluj-Napoca', 'Timișoara', 'Iași City', 'Constanța City'
  ]
};

export function getLocationsForCountry(country: string): string[] {
  return locationsByCountry[country] || [];
}
