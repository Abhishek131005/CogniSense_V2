/**
 * src/pages/SpeechPage.jsx
 *
 * Route: /speech
 * CogniScan speech workflow ported to React inside CogniSense.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AudioLines,
  ChevronDown,
  FlaskConical,
  Languages,
  Mic,
  Save,
  Square,
  Upload,
  UserRound,
} from 'lucide-react'

import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { PatientSelector } from '../components/patient/PatientSelector'
import { useApp } from '../context/AppContext'
import { analyzeSpeechAudio, analyzeSpeechDemo } from '../services/speech'
import { createAssessment } from '../services/firestore'
import kitchenSceneImage from '../assets/prompts/kitchen-scene.svg'
import parkSceneImage from '../assets/prompts/park-scene.svg'
import marketSceneImage from '../assets/prompts/market-scene.svg'

const languageOptions = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'pa', label: 'Punjabi' },
]

const SAMPLE_PARAGRAPHS_BY_LANG = {
  auto: [
    'In a small family kitchen, two children stand near a chair placed below a high shelf. The older child carefully reaches upward toward a glass cookie jar, while the younger child steadies the chair with both hands. At the sink, their mother washes dishes and looks focused on the running water. A cup sits near the edge of the counter, and a towel hangs beside the sink. The scene feels lively but slightly tense, because everyone is busy with different tasks at the same time.',
    'At sunset in a public park, people move along a wide walking path while children play nearby. A young girl runs after a yellow ball, and her father bends slightly as he calls out to her with a smile. Two friends sit on a wooden bench and talk quietly, while a street vendor arranges fruit in small baskets under a shaded stall. In the background, trees sway gently in the evening breeze and the sky turns warm orange over the open lawn.',
  ],
  en: [
    'In this kitchen scene, a young boy stretches toward a cookie jar on a high shelf while balancing on a chair. His sister stands close by and holds the chair legs to keep him steady. Their mother faces the sink, washing plates and cups, and she does not notice the children behind her. A dish towel hangs near the counter, and water from the tap glints under the room light. The moment feels ordinary and warm, yet there is a clear sense of risk in the children\'s movement.',
    'In a crowded neighborhood market, people move from stall to stall with cloth bags in their hands. A fruit seller arranges oranges and bananas in neat rows while speaking with an elderly customer. Near a vegetable stand, a child points at fresh tomatoes as his mother compares prices. Two school students pass by, laughing and sharing a snack. The air is full of motion and conversation, and every corner of the market shows a different small activity happening at once.',
  ],
  hi: [
    'एक छोटे से रसोईघर में दो बच्चे ऊंची शेल्फ पर रखे बिस्कुट के जार तक पहुंचने की कोशिश कर रहे हैं। बड़ा बच्चा कुर्सी पर खड़ा है और ऊपर हाथ बढ़ा रहा है, जबकि छोटी बहन कुर्सी को पकड़े हुए है ताकि वह गिर न जाए। उसी समय उनकी मां सिंक के पास बर्तन धो रही हैं और पानी की आवाज़ में व्यस्त हैं। काउंटर पर कप, प्लेट और तौलिया रखा है। दृश्य सामान्य घरेलू माहौल दिखाता है, लेकिन बच्चों की हरकत में हल्का सा जोखिम भी महसूस होता है।',
    'शाम के समय एक पार्क में अलग-अलग लोग अपनी गतिविधियों में लगे हुए हैं। कुछ बच्चे गेंद खेल रहे हैं, एक पिता अपनी बेटी को आवाज़ देकर पास बुला रहा है, और पास की बेंच पर दो बुजुर्ग धीरे-धीरे बातचीत कर रहे हैं। एक विक्रेता फलों की टोकरी सजाकर ग्राहकों का इंतजार कर रहा है। पेड़ों के पीछे ढलती धूप से पूरा पार्क सुनहरा दिख रहा है। माहौल शांत भी है और जीवंत भी, क्योंकि हर तरफ छोटी-छोटी गतिविधियां एक साथ चल रही हैं।',
  ],
  mr: [
    'एका छोट्या स्वयंपाकघरात दोन मुले उंच शेल्फवर ठेवलेल्या बिस्किटांच्या बाटलीकडे हात पोचवण्याचा प्रयत्न करत आहेत. मोठा मुलगा खुर्चीवर उभा राहून वर हात करतो आहे आणि लहान बहीण खुर्चीला धरून तोल सांभाळत आहे. त्यांच्या मागे आई सिंकजवळ भांडी धुते आहे आणि तिचे लक्ष त्या कामात आहे. काउंटरवर कप, ताटे आणि टॉवेल दिसतो. घरगुती वातावरण शांत आहे, पण मुलांच्या हालचालीत थोडासा धोका जाणवतो.',
    'संध्याकाळच्या वेळेला उद्यानात अनेक लोक वेगवेगळ्या कामांत गुंतलेले दिसतात. काही मुले चेंडू खेळत आहेत, एक वडील आपल्या मुलीला हाक मारत तिच्याकडे पाहून हसत आहेत, आणि जवळच्या बाकावर दोन व्यक्ती निवांत गप्पा मारत बसल्या आहेत. एका बाजूला विक्रेता फळांची मांडणी करत आहे. झाडांच्या फांद्यांतून येणाऱ्या प्रकाशामुळे पूर्ण परिसर उबदार आणि जिवंत वाटतो. प्रत्येक कोपऱ्यात वेगळी छोटी हालचाल सुरू आहे.',
  ],
  bn: [
    'একটি ছোট রান্নাঘরে দুই শিশু উঁচু তাকের উপর রাখা বিস্কুটের জারের দিকে হাত বাড়িয়েছে। বড় ছেলে একটি চেয়ারের উপর দাঁড়িয়ে ভারসাম্য রেখে উপরে পৌঁছাতে চাইছে, আর তার বোন চেয়ার ধরে তাকে সামলে রাখছে। তাদের মা সিঙ্কের পাশে বাসন ধুচ্ছেন এবং সেই কাজেই মনোযোগী। টেবিলের পাশে কাপ, প্লেট আর একটি তোয়ালে রাখা আছে। দৃশ্যটি ঘরোয়া ও স্বাভাবিক, কিন্তু শিশুদের নড়াচড়ায় সামান্য ঝুঁকির আভাসও আছে।',
    'সন্ধ্যার পার্কে বিভিন্ন মানুষ একসাথে নানা কাজে ব্যস্ত। কয়েকজন শিশু বল নিয়ে খেলছে, এক বাবা তার মেয়েকে ডেকে হাসিমুখে এগিয়ে আসছেন, আর কাছের বেঞ্চে দুজন বয়স্ক মানুষ ধীরস্বরে কথা বলছেন। রাস্তার ধারের একটি ছোট দোকানে বিক্রেতা ফল সাজিয়ে রাখছে। গাছের ফাঁক দিয়ে পড়া আলো পুরো পরিবেশকে নরম ও উজ্জ্বল করে তুলেছে। চারদিকে ছোট ছোট গতিবিধি মিলিয়ে দৃশ্যটি খুব জীবন্ত লাগে।',
  ],
  ta: [
    'ஒரு சிறிய சமையலறையில் இரண்டு குழந்தைகள் மேலே வைக்கப்பட்ட பிஸ்கட் ஜாரை எட்ட முயற்சிக்கிறார்கள். பெரிய குழந்தை நாற்காலியில் நின்று கை நீட்டுகிறது, சிறிய சகோதரி நாற்காலியை பிடித்து சமநிலையை காக்கிறாள். அவர்களின் அம்மா சிங்க் அருகில் பாத்திரங்கள் கழுவுவதில் கவனம் செலுத்துகிறார். மேசையின் அருகே கப், தட்டு, துணி போன்ற பொருட்கள் இருக்கின்றன. காட்சி ஒரு சாதாரண குடும்ப தருணமாக இருந்தாலும், குழந்தைகளின் அசைவில் சிறிய அபாயம் தெரிகிறது.',
    'மாலை நேர பூங்காவில் பலர் பல வேலைகளில் ஈடுபட்டு இருக்கிறார்கள். சில குழந்தைகள் பந்தை துரத்தி விளையாடுகிறார்கள், ஒரு தந்தை தன் மகளை அழைத்து புன்னகையுடன் பார்க்கிறார், அருகில் உள்ள நாற்காலியில் இரண்டு மூத்தவர்கள் அமைதியாக பேசுகிறார்கள். ஓரமாக பழக்கடை வைத்தவர் பழங்களை ஒழுங்காக அடுக்குகிறார். மரங்களின் வழியாக வரும் வெளிச்சம் முழு இடத்தையும் மென்மையாக காட்டுகிறது. ஒவ்வொரு மூலையிலும் ஒரு சிறிய செயல் நடந்துகொண்டே இருக்கும் உயிர்ப்பான சூழல் இது.',
  ],
  te: [
    'ఒక చిన్న వంటగదిలో ఇద్దరు పిల్లలు పై షెల్ఫ్‌లో ఉన్న బిస్కెట్ జార్‌ను తీసుకోవడానికి ప్రయత్నిస్తున్నారు. పెద్ద బాలుడు కుర్చీపై నిలబడి పైకి చేతిని చాపుతున్నాడు, చిన్న చెల్లి కుర్చీని పట్టుకుని అతనికి సమతుల్యం ఇస్తోంది. వారి తల్లి సింక్ దగ్గర పాత్రలు కడుగుతూ తన పనిలో నిమగ్నంగా ఉంది. కౌంటర్‌పై కప్పులు, ప్లేట్లు, తుడుచుకునే గుడ్డ కనిపిస్తున్నాయి. ఇది సాధారణ కుటుంబ దృశ్యం అయినప్పటికీ పిల్లల కదలికలో కొద్దిగా ప్రమాద భావన ఉంది.',
    'సాయంత్రం పార్క్‌లో ఎంతోమంది వేర్వేరు పనుల్లో కనిపిస్తున్నారు. కొంతమంది పిల్లలు బంతితో ఆడుకుంటున్నారు, ఒక తండ్రి తన కూతురిని నవ్వుతూ పిలుస్తున్నాడు, పక్కనే ఉన్న బెంచ్‌పై ఇద్దరు పెద్దలు నెమ్మదిగా మాట్లాడుతున్నారు. ఒక విక్రేత పండ్లను వరుసగా అమర్చి కస్టమర్ల కోసం ఎదురుచూస్తున్నాడు. చెట్ల మధ్య నుంచి వచ్చే సూర్యకాంతి వాతావరణాన్ని ఆహ్లాదకరంగా చేస్తోంది. ప్రతి మూలలో చిన్న చిన్న కదలికలతో దృశ్యం చాలా సజీవంగా అనిపిస్తుంది.',
  ],
  gu: [
    'એક નાની રસોડાની જગ્યામાં બે બાળકો ઉપરની શેલ્ફ પર રાખેલા બિસ્કિટના જાર સુધી પહોંચવાનો પ્રયાસ કરે છે. મોટો છોકરો ખુરશી પર ઊભો રહીને હાથ લંબાવે છે અને તેની બહેન ખુરશી પકડીને તેને સંતુલન આપે છે. તેમની મા સિંક પાસે વાસણ ધોવામાં વ્યસ્ત છે. નજીકમાં કપ, થાળી અને ટુવાલ જેવી વસ્તુઓ દેખાય છે. દૃશ્ય ઘરેલું અને સ્વાભાવિક લાગે છે, પરંતુ બાળકોની હલચલમાં થોડો જોખમ પણ દેખાય છે.',
    'સાંજના સમયે પાર્કમાં લોકો અલગ અલગ પ્રવૃત્તિઓમાં મશગૂલ છે. થોડા બાળકો બોલ સાથે રમે છે, એક પિતા પોતાની દીકરીને હસતાં હસતાં બોલાવે છે, અને નજીકની બેંચ પર બે વૃદ્ધ શાંતિથી વાત કરે છે. બાજુમાં ફળવાળો પોતાની ટોકરીઓ ગોઠવીને ગ્રાહકોની રાહ જુએ છે. ઝાડોમાંથી આવતો સાંજનો પ્રકાશ આખા માહોલને મીઠો બનાવે છે. દરેક ખૂણે નાની નાની ચળવળ સાથે દૃશ્ય જીવંત લાગે છે.',
  ],
  kn: [
    'ಒಂದು ಸಣ್ಣ ಅಡಿಗೆಮನೆಯಲ್ಲಿ ಇಬ್ಬರು ಮಕ್ಕಳು ಮೇಲಿನ ಶೆಲ್ಫ್‌ನಲ್ಲಿ ಇಟ್ಟಿರುವ ಬಿಸ್ಕಟ್ ಜಾರಿಗೆ ಕೈಚಾಚುತ್ತಿದ್ದಾರೆ. ದೊಡ್ಡ ಹುಡುಗ ಕುರ್ಚಿಯ ಮೇಲೆ ನಿಂತು ಮೇಲಕ್ಕೆ ತಲುಪಲು ಪ್ರಯತ್ನಿಸುತ್ತಿದ್ದಾನೆ, ಮತ್ತು ಅವನ ತಂಗಿ ಕುರ್ಚಿಯನ್ನು ಹಿಡಿದು ಅವನಿಗೆ ಸಮತೋಲನ ಕೊಡುತ್ತಿದ್ದಾಳೆ. ಅವರ ತಾಯಿ ಸಿಂಕ್ ಬಳಿ ಪಾತ್ರೆ ತೊಳೆಯುವ ಕೆಲಸದಲ್ಲಿ ತೊಡಗಿದ್ದಾಳೆ. ಕೌಂಟರ್ ಮೇಲೆ ಕಪ್, ತಟ್ಟೆ ಮತ್ತು ಟವೆಲ್ ಕಾಣಿಸುತ್ತವೆ. ದೃಶ್ಯ ಮನೆಯ ಸಾಮಾನ್ಯ ಕ್ಷಣದಂತೆ ಕಂಡರೂ ಮಕ್ಕಳ ಚಲನೆಯಲ್ಲಿ ಸ್ವಲ್ಪ ಅಪಾಯದ ಭಾವನೆ ಇದೆ.',
    'ಸಂಜೆಯ ಪಾರ್ಕ್‌ನಲ್ಲಿ ಅನೇಕ ಜನರು ತಮ್ಮ ತಮ್ಮ ಚಟುವಟಿಕೆಗಳಲ್ಲಿ ತೊಡಗಿದ್ದಾರೆ. ಕೆಲವು ಮಕ್ಕಳು ಚೆಂಡಾಟ ಆಡುತ್ತಿದ್ದಾರೆ, ಒಬ್ಬ ತಂದೆ ತನ್ನ ಮಗಳಿಗೆ ನಗುಮುಖದಿಂದ ಕರೆ ಕೊಡುತ್ತಾನೆ, ಮತ್ತು ಹತ್ತಿರದ ಬೆಂಚ್ ಮೇಲೆ ಇಬ್ಬರು ಹಿರಿಯರು ನಿಧಾನವಾಗಿ ಮಾತುಕತೆ ನಡೆಸುತ್ತಾರೆ. ಒಂದು ಬದಿ ಹಣ್ಣು ಮಾರಾಟಗಾರನು ಹಣ್ಣುಗಳನ್ನು ಸರಿಯಾಗಿ ಜೋಡಿಸುತ್ತಾನೆ. ಮರಗಳ ಮಧ್ಯೆ ಬೀಳುವ ಬೆಳಕು ಸಂಪೂರ್ಣ ಸ್ಥಳವನ್ನು ಮೃದುವಾಗಿ ಬೆಳಗಿಸುತ್ತದೆ. ಎಲ್ಲೆಲ್ಲೂ ಸಣ್ಣ ಚಲನೆಗಳಿಂದ ದೃಶ್ಯ ತುಂಬಾ ಜೀವಂತವಾಗಿ ಕಾಣುತ್ತದೆ.',
  ],
  ml: [
    'ഒരു ചെറിയ അടുക്കളയിൽ രണ്ടു കുട്ടികൾ മുകളിലുള്ള ഷെൽഫിൽ വെച്ച ബിസ്കറ്റ് ജാർ കൈവരിക്കാൻ ശ്രമിക്കുന്നു. വലിയ കുട്ടി കസേരയുടെ മുകളിൽ നിൽക്കി കൈ നീട്ടുന്നു, ചെറുത്തി കസേര പിടിച്ച് അവനെ താങ്ങുന്നു. അവരുടെ അമ്മ സിങ്കിന് സമീപം പാത്രം കഴുകുന്നതിൽ മുഴുകിയിരിക്കുന്നു. കൗണ്ടറിന് സമീപം കപ്പ്, തട്ടി, തുണി എന്നിവ കാണാം. ദൃശ്യം സാധാരണ കുടുംബജീവിതത്തെ കാണിച്ചാലും കുട്ടികളുടെ ചലനത്തിൽ ചെറിയൊരു അപകടസൂചന ഉണ്ട്.',
    'സന്ധ്യ സമയത്ത് പാർക്കിൽ പലരും പല പ്രവർത്തനങ്ങളിൽ തിരക്കിലാണ്. ചില കുട്ടികൾ പന്ത് കളിക്കുന്നു, ഒരച്ഛൻ മകളെ വിളിച്ച് ചിരിച്ചുകൊണ്ട് മുന്നോട്ട് വരുന്നു, അടുത്ത ബെഞ്ചിൽ രണ്ടു മുതിർന്നവർ ശാന്തമായി സംസാരിക്കുന്നു. ഒരു വിൽപ്പനക്കാരൻ പഴങ്ങൾ നിരത്തി ഉപഭോക്താക്കളെ കാത്തിരിക്കുന്നു. മരങ്ങൾക്കിട দিয়ে വരുന്ന വെളിച്ചം മുഴുവൻ സ്ഥലത്തെയും മൃദുവായി തിളക്കമാക്കുന്നു. ഓരോ കോണിലും ചെറിയ ചെറിയ ചലനങ്ങൾ കൊണ്ട് ദൃശ്യം സജീവമായി തോന്നുന്നു.',
  ],
  pa: [
    'ਇੱਕ ਛੋਟੀ ਰਸੋਈ ਵਿੱਚ ਦੋ ਬੱਚੇ ਉੱਪਰਲੀ ਸ਼ੈਲਫ਼ ਤੇ ਰੱਖੇ ਬਿਸਕੁਟ ਦੇ ਜਾਰ ਤੱਕ ਪਹੁੰਚਣ ਦੀ ਕੋਸ਼ਿਸ਼ ਕਰ ਰਹੇ ਹਨ। ਵੱਡਾ ਬੱਚਾ ਕੁਰਸੀ ਉੱਤੇ ਖੜ੍ਹਾ ਹੋ ਕੇ ਹੱਥ ਉੱਪਰ ਕਰਦਾ ਹੈ ਅਤੇ ਛੋਟੀ ਭੈਣ ਕੁਰਸੀ ਨੂੰ ਫੜ ਕੇ ਉਸਦਾ ਸੰਤੁਲਨ ਬਣਾਈ ਰੱਖਦੀ ਹੈ। ਉਨ੍ਹਾਂ ਦੀ ਮਾਂ ਸਿੰਕ ਕੋਲ ਬਰਤਨ ਧੋਂਦੀ ਹੋਈ ਆਪਣੇ ਕੰਮ ਵਿੱਚ ਮਸ਼ਗੂਲ ਹੈ। ਕਾਊਂਟਰ ਕੋਲ ਕੱਪ, ਪਲੇਟ ਅਤੇ ਤੌਲੀਆ ਦਿੱਸਦੇ ਹਨ। ਦ੍ਰਿਸ਼ ਘਰੇਲੂ ਤੇ ਆਮ ਹੈ, ਪਰ ਬੱਚਿਆਂ ਦੀ ਹਰਕਤ ਵਿੱਚ ਹਲਕਾ ਜੋਖਮ ਵੀ ਦਿੱਸਦਾ ਹੈ।',
    'ਸ਼ਾਮ ਵੇਲੇ ਪਾਰਕ ਵਿੱਚ ਵੱਖ-ਵੱਖ ਲੋਕ ਵੱਖਰੀਆਂ ਗਤੀਵਿਧੀਆਂ ਕਰ ਰਹੇ ਹਨ। ਕੁਝ ਬੱਚੇ ਗੇਂਦ ਨਾਲ ਖੇਡ ਰਹੇ ਹਨ, ਇੱਕ ਪਿਤਾ ਆਪਣੀ ਧੀ ਨੂੰ ਮੁਸਕਰਾਹਟ ਨਾਲ ਆਵਾਜ਼ ਦੇ ਰਿਹਾ ਹੈ, ਅਤੇ ਨੇੜੇ ਬੈਂਚ ਉੱਤੇ ਦੋ ਬਜ਼ੁਰਗ ਹੌਲੀ ਹੌਲੀ ਗੱਲ ਕਰ ਰਹੇ ਹਨ। ਇਕ ਫਲ ਵੇਚਣ ਵਾਲਾ ਆਪਣੀਆਂ ਟੋਕਰੀਆਂ ਸਜਾ ਕੇ ਗਾਹਕਾਂ ਦੀ ਉਡੀਕ ਕਰਦਾ ਹੈ। ਦਰੱਖਤਾਂ ਵਿਚੋਂ ਆਉਣ ਵਾਲੀ ਰੋਸ਼ਨੀ ਸਾਰੇ ਮਾਹੌਲ ਨੂੰ ਨਰਮ ਬਣਾਉਂਦੀ ਹੈ। ਹਰ ਕੋਨੇ ਵਿੱਚ ਛੋਟੀਆਂ ਗਤੀਵਿਧੀਆਂ ਨਾਲ ਦ੍ਰਿਸ਼ ਜ਼ਿੰਦਾ ਲੱਗਦਾ ਹੈ।',
  ],
}

const IMAGE_PROMPTS = [
  {
    id: 'kitchen-cookie',
    title: 'Kitchen Action Scene',
    image: kitchenSceneImage,
    hintByLang: {
      en: 'Read this passage with a steady pace and natural pauses.',
      hi: 'इस अनुच्छेद को सामान्य गति और स्पष्ट उच्चारण के साथ पढ़ें।',
      mr: 'हा परिच्छेद नैसर्गिक गतीने आणि स्पष्ट उच्चारांसह वाचा.',
    },
  },
  {
    id: 'park-evening',
    title: 'Evening Park Scene',
    image: parkSceneImage,
    hintByLang: {
      en: 'Read this passage continuously for about one minute.',
      hi: 'इसे लगभग एक मिनट तक लगातार पढ़ें।',
      mr: 'हे साधारण एक मिनिट सलग वाचा.',
    },
  },
  {
    id: 'market-day',
    title: 'Busy Market Scene',
    image: marketSceneImage,
    hintByLang: {
      en: 'Read this market-scene paragraph clearly and naturally.',
      hi: 'इस बाज़ार-दृश्य वाले अनुच्छेद को स्पष्ट और स्वाभाविक रूप से पढ़ें।',
      mr: 'हा बाजार-दृश्य परिच्छेद स्पष्ट आणि नैसर्गिकरीत्या वाचा.',
    },
  },
]

const ANALYSIS_STAGES = [
  'Extracting MFCCs...',
  'Computing pitch and pause dynamics...',
  'Running lexical analysis...',
  'Estimating cognitive risk score...',
]

function riskClass(score) {
  if (score < 25) return 0
  if (score < 45) return 1
  if (score < 65) return 2
  return 3
}

function riskColorFromClass(c) {
  if (c === 3) return 'var(--risk-critical)'
  if (c === 2) return 'var(--risk-high)'
  if (c === 1) return 'var(--risk-medium)'
  return 'var(--risk-low)'
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value || 0))
}

function pickNextIndex(length, previousIndex) {
  if (length <= 1) return 0
  let next = Math.floor(Math.random() * length)
  if (next === previousIndex) {
    next = (next + 1) % length
  }
  return next
}

function pickPrompt(languageCode, previousIndex = -1) {
  const normalized = String(languageCode || 'auto').toLowerCase()
  const list = SAMPLE_PARAGRAPHS_BY_LANG[normalized] || SAMPLE_PARAGRAPHS_BY_LANG.en
  const index = pickNextIndex(list.length, previousIndex)
  return {
    index,
    text: list[index],
  }
}

function pickImagePrompt(previousIndex = -1) {
  const index = pickNextIndex(IMAGE_PROMPTS.length, previousIndex)
  return {
    index,
    scene: IMAGE_PROMPTS[index],
  }
}

function getImageHint(scene, languageCode) {
  if (!scene) return ''
  const normalized = String(languageCode || 'auto').toLowerCase()
  return scene.hintByLang[normalized] || scene.hintByLang.en
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatRecordTime(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function isLowInformationTranscript(text) {
  const normalized = String(text || '').trim()
  if (!normalized) return true
  if (/^(?:\d+[-\s]*){8,}$/.test(normalized)) return true
  const letterCount = (normalized.match(/[A-Za-z\u0900-\u0D7F]/g) || []).length
  const digitCount = (normalized.match(/\d/g) || []).length
  if (letterCount < 3 && digitCount >= 8) return true
  return false
}

function hasReadableLetterContent(text) {
  const normalized = String(text || '').trim()
  if (!normalized) return false
  const letterCount = (normalized.match(/[A-Za-z\u0900-\u0D7F]/g) || []).length
  return letterCount >= 3
}

function getLanguageWarning(languageCode) {
  const code = String(languageCode || 'en').toLowerCase()
  const byLang = {
    en: 'Low-confidence transcript. Please re-record in a quiet room and read the full paragraph continuously.',
    hi: 'प्रतिलिपि स्पष्ट नहीं है। कृपया शांत कमरे में दोबारा रिकॉर्ड करें और पूरा अनुच्छेद लगातार पढ़ें।',
    mr: 'लिप्यंतरण स्पष्ट नाही. कृपया शांत ठिकाणी पुन्हा रेकॉर्ड करा आणि पूर्ण परिच्छेद सलग वाचा.',
    bn: 'ট্রান্সক্রিপ্ট স্পষ্ট নয়। শান্ত জায়গায় আবার রেকর্ড করুন এবং পুরো অনুচ্ছেদ পড়ুন।',
    ta: 'உரை தெளிவாக கிடைக்கவில்லை. அமைதியான இடத்தில் மீண்டும் பதிவு செய்து முழு பகுதியில் வாசிக்கவும்.',
    te: 'ట్రాన్స్క్రిప్ట్ స్పష్టంగా లేదు. నిశ్శబ్ద ప్రదేశంలో మళ్లీ రికార్డ్ చేసి మొత్తం ప్యారాగ్రాఫ్ చదవండి.',
    gu: 'ટ્રાન્સક્રિપ્ટ સ્પષ્ટ નથી. શાંત જગ્યાએ ફરીથી રેકોર્ડ કરીને પૂરું પેરાગ્રાફ વાંચો.',
    kn: 'ಟ್ರಾನ್ಸ್ಕ್ರಿಪ್ಟ್ ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ. ಶಾಂತ ಸ್ಥಳದಲ್ಲಿ ಮತ್ತೆ ರೆಕಾರ್ಡ್ ಮಾಡಿ ಪೂರ್ಣ ಪ್ಯಾರಾಗ್ರಾಫ್ ಓದಿ.',
    ml: 'ട്രാൻസ്ക്രിപ്റ്റ് വ്യക്തമായില്ല. ശാന്തമായ ഇടത്ത് വീണ്ടും റെക്കോർഡ് ചെയ്ത് മുഴുവൻ പാരഗ്രാഫും വായിക്കൂ.',
    pa: 'ਟ੍ਰਾਂਸਕ੍ਰਿਪਟ ਸਪਸ਼ਟ ਨਹੀਂ ਆਇਆ। ਕਿਰਪਾ ਕਰਕੇ ਸ਼ਾਂਤ ਥਾਂ ਤੇ ਮੁੜ ਰਿਕਾਰਡ ਕਰੋ ਅਤੇ ਪੂਰਾ ਪੈਰਾਗ੍ਰਾਫ ਪੜ੍ਹੋ।',
  }
  return byLang[code] || byLang.en
}

function encodeWav(samples, sampleRate = 16000) {
  const clipped = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i += 1) {
    const value = Number(samples[i] || 0)
    clipped[i] = Math.max(-1, Math.min(1, value))
  }

  const buffer = new ArrayBuffer(44 + clipped.length * 2)
  const view = new DataView(buffer)

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + clipped.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, clipped.length * 2, true)

  let offset = 44
  for (let i = 0; i < clipped.length; i += 1) {
    const sample = clipped[i]
    const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    view.setInt16(offset, pcm, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function MetricSection({ title, subtitle, open, onToggle, children }) {
  return (
    <div
      className="rounded-xl"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
      }}
    >
      <button
        type="button"
        className="w-full px-4 py-3 flex items-center justify-between"
        onClick={onToggle}
        aria-expanded={open}
      >
        <div className="text-left">
          <p className="label-mono">{title}</p>
          {subtitle && (
            <p
              style={{
                marginTop: 4,
                fontFamily: 'var(--font-body)',
                fontSize: '0.8125rem',
                color: 'var(--text-muted)',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        <ChevronDown
          size={16}
          color="var(--text-muted)"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        />
      </button>

      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

export default function SpeechPage() {
  const {
    currentPatient,
    patients,
    setCurrentPatient,
    addNewPatient,
  } = useApp()

  const [audioFile, setAudioFile] = useState(null)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('')
  const [language, setLanguage] = useState('auto')
  const [dragOver, setDragOver] = useState(false)

  const [processing, setProcessing] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState(ANALYSIS_STAGES[0])
  const [result, setResult] = useState(null)
  const [analysisSource, setAnalysisSource] = useState('upload')

  const [statusType, setStatusType] = useState('idle')
  const [statusText, setStatusText] = useState('Waiting for audio input.')
  const [error, setError] = useState(null)

  const [recording, setRecording] = useState(false)
  const [preparingRecording, setPreparingRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [recordingError, setRecordingError] = useState(null)
  const [promptMode, setPromptMode] = useState('paragraph')
  const [readingPrompt, setReadingPrompt] = useState('')
  const [imagePrompt, setImagePrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [countdownText, setCountdownText] = useState('')

  const [sectionsOpen, setSectionsOpen] = useState({
    flags: true,
    acoustic: true,
    lexical: true,
    mfcc: true,
  })

  const [saving, setSaving] = useState(false)
  const [savedAssessmentId, setSavedAssessmentId] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [saveTargetPatientId, setSaveTargetPatientId] = useState('')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddSaving, setQuickAddSaving] = useState(false)
  const [quickAddError, setQuickAddError] = useState(null)
  const [quickAddForm, setQuickAddForm] = useState({
    name: '',
    age: '',
    gender: 'Female',
    phone: '',
  })

  const fileInputRef = useRef(null)
  const waveCanvasRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const scriptProcessorRef = useRef(null)
  const animationRef = useRef(null)
  const recordTimerRef = useRef(null)
  const rawSamplesRef = useRef([])
  const sampleRateRef = useRef(16000)
  const messageRotatorRef = useRef(null)
  const isRecordingRef = useRef(false)
  const lastParagraphIndexRef = useRef(-1)
  const lastImageIndexRef = useRef(-1)
  const countdownLockRef = useRef(false)

  const canAnalyze = !!audioFile && !processing && !recording && !preparingRecording

  const selectedSavePatient = useMemo(() => {
    if (!saveTargetPatientId) return null
    return patients.find((patient) => patient.id === saveTargetPatientId) || null
  }, [patients, saveTargetPatientId])

  const riskIndex = useMemo(() => {
    if (!result) return 0
    return riskClass(Number(result.risk_score || 0))
  }, [result])

  const riskColor = useMemo(() => riskColorFromClass(riskIndex), [riskIndex])

  const acousticRows = useMemo(() => {
    const a = result?.acoustic || {}
    return [
      {
        name: 'Speech Rate',
        value: `${Number(a.speech_rate_syllables_per_min || 0).toFixed(1)} syll/min`,
        pct: clampPercent((Number(a.speech_rate_syllables_per_min || 0) / 350) * 100),
        status:
          Number(a.speech_rate_syllables_per_min || 0) < 150
            ? 'bad'
            : Number(a.speech_rate_syllables_per_min || 0) < 200
              ? 'warn'
              : 'ok',
      },
      {
        name: 'Pause Count',
        value: `${a.pause_count || 0} pauses`,
        pct: clampPercent((Number(a.pause_count || 0) / 30) * 100),
        status:
          Number(a.pause_count || 0) > 20
            ? 'bad'
            : Number(a.pause_count || 0) > 12
              ? 'warn'
              : 'ok',
      },
      {
        name: 'Pause Ratio',
        value: `${(Number(a.pause_ratio || 0) * 100).toFixed(1)}%`,
        pct: clampPercent(Number(a.pause_ratio || 0) * 200),
        status:
          Number(a.pause_ratio || 0) > 0.5
            ? 'bad'
            : Number(a.pause_ratio || 0) > 0.35
              ? 'warn'
              : 'ok',
      },
      {
        name: 'Mean Pause',
        value: `${Math.round(Number(a.mean_pause_duration_ms || 0))} ms`,
        pct: clampPercent((Number(a.mean_pause_duration_ms || 0) / 1500) * 100),
        status:
          Number(a.mean_pause_duration_ms || 0) > 700
            ? 'bad'
            : Number(a.mean_pause_duration_ms || 0) > 400
              ? 'warn'
              : 'ok',
      },
      {
        name: 'F0 Mean',
        value: `${Number(a.f0_mean_hz || 0).toFixed(1)} Hz`,
        pct: clampPercent((Number(a.f0_mean_hz || 0) / 400) * 100),
        status: 'ok',
      },
      {
        name: 'F0 Std Dev',
        value: `${Number(a.f0_std_hz || 0).toFixed(1)} Hz`,
        pct: clampPercent((Number(a.f0_std_hz || 0) / 60) * 100),
        status: Number(a.f0_std_hz || 0) < 8 ? 'warn' : 'ok',
      },
      {
        name: 'Jitter',
        value: `${(Number(a.jitter || 0) * 100).toFixed(3)}%`,
        pct: clampPercent(Number(a.jitter || 0) * 1500),
        status:
          Number(a.jitter || 0) > 0.05
            ? 'bad'
            : Number(a.jitter || 0) > 0.02
              ? 'warn'
              : 'ok',
      },
      {
        name: 'Shimmer',
        value: `${(Number(a.shimmer || 0) * 100).toFixed(3)}%`,
        pct: clampPercent(Number(a.shimmer || 0) * 600),
        status:
          Number(a.shimmer || 0) > 0.1
            ? 'bad'
            : Number(a.shimmer || 0) > 0.05
              ? 'warn'
              : 'ok',
      },
      {
        name: 'HNR',
        value: `${Number(a.hnr_db || 0).toFixed(2)} dB`,
        pct: clampPercent((Math.max(Number(a.hnr_db || 0), 0) / 30) * 100),
        status:
          Number(a.hnr_db || 0) < 10
            ? 'bad'
            : Number(a.hnr_db || 0) < 15
              ? 'warn'
              : 'ok',
      },
      {
        name: 'Vocal Energy',
        value: `${(Number(a.vocal_energy_mean || 0) * 1000).toFixed(2)} x10^-3`,
        pct: clampPercent(Number(a.vocal_energy_mean || 0) * 5000),
        status: 'ok',
      },
    ]
  }, [result])

  const lexicalRows = useMemo(() => {
    const l = result?.lexico_semantic || {}
    return [
      {
        name: 'Word Count',
        value: `${l.word_count || 0} words`,
        pct: clampPercent((Number(l.word_count || 0) / 200) * 100),
        status: 'ok',
      },
      {
        name: 'Unique Words',
        value: `${l.unique_word_count || 0} unique`,
        pct: clampPercent((Number(l.unique_word_count || 0) / 120) * 100),
        status: 'ok',
      },
      {
        name: 'Type-Token Ratio',
        value: Number(l.type_token_ratio || 0).toFixed(4),
        pct: clampPercent(Number(l.type_token_ratio || 0) * 100),
        status:
          Number(l.type_token_ratio || 0) < 0.4
            ? 'bad'
            : Number(l.type_token_ratio || 0) < 0.55
              ? 'warn'
              : 'ok',
      },
      {
        name: 'Filler Rate',
        value: `${(Number(l.filler_word_ratio || 0) * 100).toFixed(2)}%`,
        pct: clampPercent(Number(l.filler_word_ratio || 0) * 800),
        status:
          Number(l.filler_word_ratio || 0) > 0.1
            ? 'bad'
            : Number(l.filler_word_ratio || 0) > 0.06
              ? 'warn'
              : 'ok',
      },
      {
        name: 'Mean Word Length',
        value: `${Number(l.mean_word_length || 0).toFixed(2)} chars`,
        pct: clampPercent((Number(l.mean_word_length || 0) / 8) * 100),
        status: 'ok',
      },
    ]
  }, [result])

  const mfccValues = useMemo(() => {
    return result?.acoustic?.mfcc_means || []
  }, [result])

  const maxMfccAbs = useMemo(() => {
    if (!mfccValues.length) return 1
    return Math.max(...mfccValues.map(v => Math.abs(Number(v || 0))), 1)
  }, [mfccValues])

  const setStatus = (type, text) => {
    setStatusType(type)
    setStatusText(text)
  }

  const cleanupRecordingEngine = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }

    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect()
      } catch {
        // no-op
      }
      scriptProcessorRef.current = null
    }

    analyserRef.current = null

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {
        // no-op
      })
      audioCtxRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    isRecordingRef.current = false
  }

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl)
      }
      if (messageRotatorRef.current) {
        clearInterval(messageRotatorRef.current)
      }
      cleanupRecordingEngine()
    }
  }, [audioPreviewUrl])

  useEffect(() => {
    const onResize = () => {
      if (recording) {
        resizeWaveCanvas()
      }
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [recording])

  const replaceAudioSelection = (file, previewUrl = null) => {
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl)
    }

    setAudioFile(file)
    setAudioPreviewUrl(previewUrl || (file ? URL.createObjectURL(file) : ''))
    setResult(null)
    setSavedAssessmentId(null)
    setSaveError(null)
    setSectionsOpen({ flags: true, acoustic: true, lexical: true, mfcc: true })

    if (file) {
      setStatus('idle', `File ready: ${file.name}`)
    } else {
      setStatus('idle', 'Waiting for audio input.')
    }
  }

  const resizeWaveCanvas = () => {
    const canvas = waveCanvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth || 320
    const height = canvas.clientHeight || 88
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
  }

  const drawWaveform = () => {
    const canvas = waveCanvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    const dpr = window.devicePixelRatio || 1
    const cssWidth = canvas.clientWidth || 320
    const cssHeight = canvas.clientHeight || 88

    const render = () => {
      if (!isRecordingRef.current) {
        animationRef.current = null
        return
      }

      animationRef.current = requestAnimationFrame(render)
      analyser.getByteTimeDomainData(dataArray)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      ctx.fillStyle = '#0a0d0f'
      ctx.fillRect(0, 0, cssWidth, cssHeight)

      const midY = cssHeight / 2
      const amplitude = (cssHeight / 2) * 1.25
      const waveRight = cssWidth

      ctx.beginPath()
      ctx.strokeStyle = 'rgba(107,145,98,0.35)'
      ctx.lineWidth = 1
      ctx.moveTo(0, midY)
      ctx.lineTo(waveRight, midY)
      ctx.stroke()

      ctx.beginPath()
      ctx.strokeStyle = '#6b9162'
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.shadowColor = 'rgba(107,145,98,0.45)'
      ctx.shadowBlur = 6

      const sliceWidth = waveRight / dataArray.length
      let x = 0

      for (let i = 0; i < dataArray.length; i += 1) {
        const normalized = (dataArray[i] - 128) / 128
        const y = Math.max(2, Math.min(cssHeight - 2, midY + (normalized * amplitude)))
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
        x += sliceWidth
      }

      ctx.stroke()
      ctx.shadowBlur = 0
    }

    render()
  }

  const startRecordingEngine = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaStreamRef.current = stream

    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    const audioCtx = new AudioContextClass()
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume()
    }
    audioCtxRef.current = audioCtx
    sampleRateRef.current = audioCtx.sampleRate || 16000

    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.85
    analyserRef.current = analyser

    const scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1)
    scriptProcessor.onaudioprocess = (event) => {
      rawSamplesRef.current.push(...event.inputBuffer.getChannelData(0))
    }
    scriptProcessorRef.current = scriptProcessor

    const zeroGain = audioCtx.createGain()
    zeroGain.gain.value = 0

    source.connect(analyser)
    source.connect(scriptProcessor)
    scriptProcessor.connect(zeroGain)
    zeroGain.connect(audioCtx.destination)

    rawSamplesRef.current = []
    setRecording(true)
    isRecordingRef.current = true
    setRecordSeconds(0)
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
    }
    recordTimerRef.current = setInterval(() => {
      setRecordSeconds(prev => prev + 1)
    }, 1000)

    resizeWaveCanvas()
    drawWaveform()
    setStatus('running', 'Recording in progress...')
  }

  const startRecordingFlow = async () => {
    if (recording || preparingRecording || processing || countdownLockRef.current) return

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setRecordingError('Live recording is not supported in this browser.')
      return
    }

    setRecordingError(null)
    setError(null)
    countdownLockRef.current = true
    setPreparingRecording(true)
    setShowPrompt(true)

    if (promptMode === 'image') {
      const { index, scene } = pickImagePrompt(lastImageIndexRef.current)
      lastImageIndexRef.current = index
      setImagePrompt(scene)
      setReadingPrompt(getImageHint(scene, language))
    } else {
      const { index, text } = pickPrompt(language, lastParagraphIndexRef.current)
      lastParagraphIndexRef.current = index
      setImagePrompt(null)
      setReadingPrompt(text)
    }

    setCountdownText('3')
    setStatus('running', 'Get ready to speak...')

    try {
      const countdownSequence = ['3', '2', '1', 'GO']
      for (let i = 0; i < countdownSequence.length; i += 1) {
        const tick = countdownSequence[i]
        setCountdownText(tick)
        await delay(tick === 'GO' ? 500 : 1000)
      }
      await startRecordingEngine()
    } catch (err) {
      cleanupRecordingEngine()
      setShowPrompt(false)
      setCountdownText('')
      setStatus('error', 'Could not start recording.')
      setRecordingError(err.message || 'Could not start recording.')
    } finally {
      setPreparingRecording(false)
      setCountdownText('')
      countdownLockRef.current = false
    }
  }

  const stopRecording = () => {
    if (!recording) return

    setRecording(false)
    isRecordingRef.current = false
    setShowPrompt(false)
    setCountdownText('')

    const samples = rawSamplesRef.current
    const sampleRate = sampleRateRef.current || 16000
    cleanupRecordingEngine()

    if (samples && samples.length > 0) {
      const wavBlob = encodeWav(samples, sampleRate)
      const file = new File([wavBlob], `recording-${Date.now()}.wav`, { type: 'audio/wav' })
      replaceAudioSelection(file)
      setStatus('idle', `Recording ready (${formatRecordTime(recordSeconds)})`)
    } else {
      setStatus('idle', 'Recording stopped.')
    }
  }

  useEffect(() => {
    if (!currentPatient && !saveTargetPatientId && patients.length > 0) {
      setSaveTargetPatientId(patients[0].id)
    }
  }, [currentPatient, patients, saveTargetPatientId])

  const runAnalysis = async () => {
    if (!canAnalyze) return

    setError(null)
    setSaveError(null)
    setSavedAssessmentId(null)
    setProcessing(true)
    setLoadingMessage(ANALYSIS_STAGES[0])
    setStatus('running', 'Uploading and analyzing...')
    setAnalysisSource('upload')

    let stageIndex = 0
    if (messageRotatorRef.current) {
      clearInterval(messageRotatorRef.current)
    }
    messageRotatorRef.current = setInterval(() => {
      stageIndex = (stageIndex + 1) % ANALYSIS_STAGES.length
      setLoadingMessage(ANALYSIS_STAGES[stageIndex])
    }, 900)

    try {
      const analysis = await analyzeSpeechAudio(audioFile, language)
      setResult(analysis)
      setStatus('done', 'Analysis complete.')
      setSectionsOpen({ flags: true, acoustic: true, lexical: true, mfcc: true })
    } catch (err) {
      setError(err.message || 'Speech analysis failed')
      setStatus('error', 'Analysis failed. Check backend status and try again.')
    } finally {
      if (messageRotatorRef.current) {
        clearInterval(messageRotatorRef.current)
        messageRotatorRef.current = null
      }
      setProcessing(false)
    }
  }

  const runDemo = async () => {
    if (processing || recording || preparingRecording) return

    setError(null)
    setSaveError(null)
    setSavedAssessmentId(null)
    setProcessing(true)
    setLoadingMessage('Generating demo analysis...')
    setStatus('running', 'Running demo...')
    setAnalysisSource('demo')

    try {
      const analysis = await analyzeSpeechDemo()
      setResult(analysis)
      setStatus('done', 'Demo analysis complete.')
      setSectionsOpen({ flags: true, acoustic: true, lexical: true, mfcc: true })
    } catch (err) {
      setError(err.message || 'Demo analysis failed')
      setStatus('error', 'Demo failed. Is backend running?')
    } finally {
      setProcessing(false)
    }
  }

  const saveResultToProfile = async (targetPatient = currentPatient) => {
    if (!targetPatient || !result || saving || savedAssessmentId) return

    setSaving(true)
    setSaveError(null)

    const payload = {
      type: 'speech',
      patientId: targetPatient.id,
      startTimestamp: new Date(),
      submitTimestamp: new Date(),
      administeredBy: 'GP_MOCK',
      source: analysisSource,
      language,
      audioFileName: audioFile?.name || null,
      speech: result,
      speechRiskScore: result.risk_score,
      speechRiskClass: result.risk_class,
      recommendation: result.interpretation?.recommended_action || '',
      flags: result.interpretation?.key_flags || [],
    }

    try {
      const assessmentId = await createAssessment(targetPatient.id, payload)
      setSavedAssessmentId(assessmentId)
      if (!currentPatient || currentPatient.id !== targetPatient.id) {
        setCurrentPatient(targetPatient)
      }
    } catch (err) {
      setSaveError(err.message || 'Could not save speech result.')
    } finally {
      setSaving(false)
    }
  }

  const saveToSelectedPatient = async () => {
    if (!selectedSavePatient) {
      setSaveError('Select a patient before saving.')
      return
    }
    await saveResultToProfile(selectedSavePatient)
  }

  const createPatientAndSave = async () => {
    const name = quickAddForm.name.trim()
    const age = Number(quickAddForm.age)
    if (!name) {
      setQuickAddError('Patient name is required.')
      return
    }
    if (!Number.isFinite(age) || age <= 0) {
      setQuickAddError('Enter a valid age.')
      return
    }

    setQuickAddSaving(true)
    setQuickAddError(null)
    setSaveError(null)
    try {
      const createdPatient = await addNewPatient({
        name,
        age,
        gender: quickAddForm.gender,
        phone: quickAddForm.phone.trim(),
      })
      setSaveTargetPatientId(createdPatient.id)
      await saveResultToProfile(createdPatient)
      setQuickAddForm({ name: '', age: '', gender: 'Female', phone: '' })
      setQuickAddOpen(false)
    } catch (err) {
      setQuickAddError(err.message || 'Could not create patient profile.')
    } finally {
      setQuickAddSaving(false)
    }
  }

  const toggleSection = (key) => {
    setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const statusColor =
    statusType === 'done'
      ? 'var(--risk-low)'
      : statusType === 'running'
        ? 'var(--risk-medium)'
        : statusType === 'error'
          ? 'var(--risk-critical)'
          : 'var(--text-muted)'

  const resultFlags = result?.interpretation?.key_flags || []
  const transcriptText = useMemo(() => {
    const raw = String(result?.lexico_semantic?.transcript || '').trim()
    const selectedLanguage = String(language || 'auto').toLowerCase()
    if (!raw) {
      return getLanguageWarning(selectedLanguage === 'auto' ? result?.lexico_semantic?.detected_language : selectedLanguage)
    }
    if (isLowInformationTranscript(raw) && !hasReadableLetterContent(raw)) {
      return getLanguageWarning(selectedLanguage === 'auto' ? result?.lexico_semantic?.detected_language : selectedLanguage)
    }
    return raw
  }, [result?.lexico_semantic?.detected_language, result?.lexico_semantic?.transcript, language])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      <Navbar />

      {preparingRecording && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center px-4"
          style={{
            background: 'rgba(8, 10, 9, 0.84)',
            backdropFilter: 'blur(3px)',
          }}
        >
          <style>{`
            @keyframes speech-countdown-pop {
              0% { transform: scale(0.7) translateY(14px); opacity: 0.08; filter: blur(6px); }
              28% { transform: scale(1.12) translateY(0); opacity: 1; filter: blur(0); }
              72% { transform: scale(0.98); opacity: 0.95; }
              100% { transform: scale(1); opacity: 1; }
            }

            @keyframes speech-countdown-ring-spin {
              0% { transform: rotate(0deg) scale(0.95); opacity: 0.42; }
              100% { transform: rotate(360deg) scale(1.02); opacity: 1; }
            }

            @keyframes speech-countdown-core-pulse {
              0% { box-shadow: 0 0 0 0 rgba(92,143,104,0.25); }
              70% { box-shadow: 0 0 0 24px rgba(92,143,104,0); }
              100% { box-shadow: 0 0 0 0 rgba(92,143,104,0); }
            }
          `}</style>
          <div
            className="w-full max-w-xl rounded-xl p-6"
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 350,
            }}
          >
            <div
              key={`shell-${countdownText}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 'min(68vw, 300px)',
                aspectRatio: '1 / 1',
                borderRadius: 999,
                border: '2px solid rgba(255,255,255,0.22)',
                background: 'radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.04) 65%, rgba(255,255,255,0) 100%)',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 30px 90px rgba(0,0,0,0.32)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 10,
                  borderRadius: 999,
                  border: '2px solid rgba(92,143,104,0.35)',
                  borderTopColor: 'rgba(196,168,79,0.82)',
                  borderRightColor: 'rgba(196,168,79,0.35)',
                  animation: 'speech-countdown-ring-spin 1s linear infinite',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: '22%',
                  borderRadius: 999,
                  background: 'radial-gradient(circle at center, rgba(92,143,104,0.22) 0%, rgba(92,143,104,0.08) 70%, rgba(92,143,104,0.02) 100%)',
                  animation: 'speech-countdown-core-pulse 1s ease-out infinite',
                }}
              />
              <div
                key={countdownText}
                style={{
                  position: 'relative',
                  zIndex: 2,
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(5rem, 16vw, 8rem)',
                  lineHeight: 1,
                  color: '#f8f7f3',
                  textShadow: '0 4px 20px rgba(0,0,0,0.35)',
                  animation: 'speech-countdown-pop 900ms cubic-bezier(0.2, 0.85, 0.25, 1)',
                }}
              >
                {countdownText}
              </div>
            </div>
          </div>
        </div>
      )}

      <main
        className="flex-1"
        style={
          preparingRecording
            ? { filter: 'blur(2px)', opacity: 0.18, pointerEvents: 'none', userSelect: 'none' }
            : undefined
        }
      >
        <div className="container py-8">
          <PageHeader
            label="SPEECH MODULE · ACOUSTIC + LEXICAL"
            title="Speech Biomarker"
            italicWord="Assessment"
            description="Upload or record a speech sample, analyze acoustic and lexical biomarkers, then save the assessment to the selected patient profile."
          />

          <div className="mb-8">
            <PatientSelector />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <section
              className="rounded-xl p-5 h-full"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Upload size={16} color="var(--accent-primary)" />
                  <span className="label-mono">Audio Input</span>
                </div>
                <span
                  className="label-mono"
                  style={{
                    color: statusColor,
                    letterSpacing: '0.08em',
                  }}
                >
                  {statusType.toUpperCase()}
                </span>
              </div>

              <div
                className="rounded-lg p-4"
                style={{
                  border: `1px dashed ${dragOver ? 'var(--accent-primary)' : 'var(--divider)'}`,
                  background: dragOver ? 'rgba(92,143,104,0.08)' : 'var(--canvas-bg)',
                  transition: 'all 0.15s ease',
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragOver(false)
                  const dropped = event.dataTransfer.files?.[0]
                  if (dropped) {
                    replaceAudioSelection(dropped)
                  }
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.9375rem',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                  }}
                >
                  {audioFile ? audioFile.name : 'Drop audio here or browse'}
                </p>
                <p
                  style={{
                    marginTop: 4,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6875rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  WAV preferred, MP3/WebM supported by backend decoder
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<Upload size={14} />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose File
                  </Button>
                  {audioFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => replaceAudioSelection(null, '')}
                    >
                      Clear
                    </Button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const selected = event.target.files?.[0]
                    if (selected) {
                      replaceAudioSelection(selected)
                    }
                    event.target.value = ''
                  }}
                />
              </div>

              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2 items-center">
                <Button
                  type="button"
                  variant={recording ? 'danger' : 'ghost'}
                  size="sm"
                  className="w-full"
                  onClick={recording ? stopRecording : startRecordingFlow}
                  disabled={processing || preparingRecording}
                  icon={recording ? <Square size={14} /> : <Mic size={14} />}
                >
                  {recording ? 'Stop Recording' : preparingRecording ? 'Preparing...' : 'Record Live'}
                </Button>
                <span
                  className="label-mono"
                  style={{
                    minWidth: 64,
                    textAlign: 'right',
                    color: recording ? 'var(--risk-critical)' : 'var(--text-muted)',
                  }}
                >
                  {formatRecordTime(recordSeconds)}
                </span>
              </div>

              {showPrompt && !preparingRecording && (
                <div
                  className="mt-3 rounded-lg p-3"
                  style={{
                    background: 'rgba(196,168,79,0.12)',
                    border: '1px solid rgba(196,168,79,0.28)',
                    minHeight: 260,
                  }}
                >
                  <p className="label-mono" style={{ color: 'var(--risk-medium)' }}>
                    {promptMode === 'image' ? 'Describe During Recording' : 'Read During Recording'}{' '}
                    {language !== 'auto' ? `(${language.toUpperCase()})` : ''}
                  </p>
                  {promptMode === 'image' && imagePrompt && (
                    <div
                      className="mt-2 rounded-md overflow-hidden"
                      style={{
                        border: '1px solid rgba(0,0,0,0.1)',
                        background: 'var(--canvas-bg)',
                        minHeight: 156,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <img
                        src={imagePrompt.image}
                        alt={imagePrompt.title}
                        style={{ width: '100%', height: 156, objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                  )}
                  <p
                    className="mt-2"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                      color: 'var(--text-primary)',
                      lineHeight: 1.5,
                    }}
                  >
                    {readingPrompt}
                  </p>
                  <p
                    className="mt-2"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8125rem',
                      color: 'var(--accent-primary)',
                    }}
                  >
                    {countdownText}
                  </p>
                </div>
              )}

              {(recording || preparingRecording) && (
                <div
                  className="mt-3 rounded-lg p-2 relative"
                  style={{
                    background: '#0a0d0f',
                    border: '1px solid rgba(0,0,0,0.2)',
                  }}
                >
                  <span
                    className="label-mono"
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 10,
                      color: 'rgba(255,255,255,0.88)',
                      background: 'rgba(0,0,0,0.45)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      borderRadius: 999,
                      padding: '2px 8px',
                    }}
                  >
                    {formatRecordTime(recordSeconds)}
                  </span>
                  <canvas
                    ref={waveCanvasRef}
                    style={{ width: '100%', height: 88, borderRadius: 8 }}
                    aria-label="Live recording waveform"
                  />
                </div>
              )}

              {audioPreviewUrl && (
                <div className="mt-3">
                  <audio controls src={audioPreviewUrl} style={{ width: '100%' }} />
                </div>
              )}

              {recordingError && (
                <p
                  className="mt-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.8125rem',
                    color: 'var(--risk-critical)',
                  }}
                >
                  {recordingError}
                </p>
              )}

              <div className="mt-4">
                <label className="label-mono mb-2 block">Language</label>
                <div className="relative">
                  <Languages
                    size={14}
                    style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }}
                  />
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className="w-full"
                    style={{
                      padding: '10px 12px 10px 32px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      background: 'var(--canvas-bg)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                    }}
                  >
                    {languageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label className="label-mono mb-2 block">Recording Prompt Type</label>
                <select
                  value={promptMode}
                  onChange={(event) => setPromptMode(event.target.value)}
                  className="w-full"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    background: 'var(--canvas-bg)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="paragraph">Paragraph to Read</option>
                  <option value="image">Image to Describe</option>
                </select>
              </div>

              <div
                className="mt-4 rounded-lg px-3 py-2"
                style={{
                  border: '1px solid var(--border-light)',
                  background: 'rgba(0,0,0,0.02)',
                }}
              >
                <p className="label-mono">Status</p>
                <p
                  className="mt-1"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.8125rem',
                    color: statusColor,
                  }}
                >
                  {statusText}
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={runAnalysis}
                  disabled={!canAnalyze}
                  loading={processing}
                  icon={<Activity size={15} />}
                >
                  Analyze Speech
                </Button>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={runDemo}
                  disabled={processing || recording || preparingRecording}
                  icon={<FlaskConical size={14} />}
                >
                  Run Demo Result
                </Button>
              </div>

              {error && (
                <div
                  className="mt-4 rounded-lg p-3"
                  style={{
                    border: '1px solid rgba(176,64,64,0.3)',
                    background: 'rgba(176,64,64,0.08)',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.8125rem',
                      color: 'var(--risk-critical)',
                    }}
                  >
                    {error}
                  </p>
                </div>
              )}

              {result && (
                <div
                  className="mt-4 rounded-lg p-3"
                  style={{
                    border: '1px solid rgba(92,143,104,0.3)',
                    background: 'rgba(92,143,104,0.08)',
                  }}
                >
                  {!currentPatient ? (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <UserRound size={14} color="var(--risk-high)" style={{ marginTop: 2, flexShrink: 0 }} />
                        <p
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '0.8125rem',
                            color: 'var(--text-primary)',
                          }}
                        >
                          No patient selected. Choose an existing patient or add a new one, then save this speech result.
                        </p>
                      </div>

                      {patients.length > 0 && (
                        <div className="grid gap-2">
                          <label className="label-mono">Select Existing Patient</label>
                          <select
                            value={saveTargetPatientId}
                            onChange={(event) => setSaveTargetPatientId(event.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-light)',
                              background: 'var(--canvas-bg)',
                              fontFamily: 'var(--font-body)',
                              fontSize: '0.875rem',
                            }}
                          >
                            {patients.map((patient) => (
                              <option key={patient.id} value={patient.id}>
                                {patient.name} ({patient.age}y, {patient.gender})
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="accent"
                            size="sm"
                            onClick={saveToSelectedPatient}
                            icon={<Save size={14} />}
                            loading={saving}
                            disabled={saving || !!savedAssessmentId || !selectedSavePatient}
                          >
                            Save to Selected Patient
                          </Button>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="label-mono">Or Add New Patient</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setQuickAddOpen((prev) => !prev)}
                        >
                          {quickAddOpen ? 'Hide Form' : 'Add New Patient'}
                        </Button>
                      </div>

                      {quickAddOpen && (
                        <div className="grid gap-2">
                          <input
                            type="text"
                            value={quickAddForm.name}
                            onChange={(event) => setQuickAddForm((prev) => ({ ...prev, name: event.target.value }))}
                            placeholder="Patient name"
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-light)',
                              background: 'var(--canvas-bg)',
                              fontFamily: 'var(--font-body)',
                              fontSize: '0.875rem',
                            }}
                          />

                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              min="1"
                              max="120"
                              value={quickAddForm.age}
                              onChange={(event) => setQuickAddForm((prev) => ({ ...prev, age: event.target.value }))}
                              placeholder="Age"
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-light)',
                                background: 'var(--canvas-bg)',
                                fontFamily: 'var(--font-body)',
                                fontSize: '0.875rem',
                              }}
                            />

                            <select
                              value={quickAddForm.gender}
                              onChange={(event) => setQuickAddForm((prev) => ({ ...prev, gender: event.target.value }))}
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-light)',
                                background: 'var(--canvas-bg)',
                                fontFamily: 'var(--font-body)',
                                fontSize: '0.875rem',
                              }}
                            >
                              <option value="Female">Female</option>
                              <option value="Male">Male</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>

                          <input
                            type="text"
                            value={quickAddForm.phone}
                            onChange={(event) => setQuickAddForm((prev) => ({ ...prev, phone: event.target.value }))}
                            placeholder="Phone (optional)"
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-light)',
                              background: 'var(--canvas-bg)',
                              fontFamily: 'var(--font-body)',
                              fontSize: '0.875rem',
                            }}
                          />

                          {quickAddError && (
                            <p
                              style={{
                                fontFamily: 'var(--font-body)',
                                fontSize: '0.75rem',
                                color: 'var(--risk-critical)',
                              }}
                            >
                              {quickAddError}
                            </p>
                          )}

                          <Button
                            variant="accent"
                            size="sm"
                            onClick={createPatientAndSave}
                            icon={<Save size={14} />}
                            loading={quickAddSaving}
                            disabled={quickAddSaving || saving || !!savedAssessmentId}
                          >
                            Create Patient and Save
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.8125rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        Save this result to <strong>{currentPatient.name}</strong>?
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button
                          variant="accent"
                          size="sm"
                          onClick={saveResultToProfile}
                          icon={<Save size={14} />}
                          loading={saving}
                          disabled={saving || !!savedAssessmentId}
                        >
                          {savedAssessmentId ? 'Saved' : 'Save to Profile'}
                        </Button>
                        {savedAssessmentId && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.6875rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            ID: {savedAssessmentId}
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  {saveError && (
                    <p
                      className="mt-2"
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.75rem',
                        color: 'var(--risk-critical)',
                      }}
                    >
                      {saveError}
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-4 relative h-full">
              {processing && (
                <div
                  className="rounded-xl p-6 flex flex-col items-center justify-center"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <Spinner size="lg" />
                  <p className="label-mono mt-3">Processing</p>
                  <p
                    className="mt-2"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {loadingMessage}
                  </p>
                </div>
              )}

              {!result && !processing && (
                <div
                  className="rounded-xl p-8 text-center"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  <AudioLines size={34} color="var(--accent-primary)" style={{ margin: '0 auto 12px' }} />
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.75rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    Results will appear here
                  </p>
                  <p
                    className="mt-2"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.9375rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Upload or record a sample, then run analysis to view risk, biomarkers, and transcript.
                  </p>
                </div>
              )}

              {result && (
                <>
                  <div
                    className="rounded-xl p-5"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    <p className="label-mono">Speech Risk Score</p>
                    <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '3rem',
                            lineHeight: 1,
                            color: riskColor,
                          }}
                        >
                          {Math.round(Number(result.risk_score || 0))}
                        </p>
                        <p
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {result.risk_class || result.interpretation?.risk_class}
                        </p>
                      </div>

                      <div
                        className="rounded-full flex items-center justify-center"
                        style={{
                          width: 94,
                          height: 94,
                          border: `6px solid ${riskColor}`,
                          color: riskColor,
                          background: 'rgba(0,0,0,0.02)',
                          fontFamily: 'var(--font-display)',
                          fontSize: '1.6rem',
                          lineHeight: 1,
                        }}
                      >
                        {Math.round(Number(result.risk_score || 0))}
                      </div>
                    </div>

                    <p
                      className="mt-3"
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.6,
                      }}
                    >
                      {result.interpretation?.clinical_summary}
                    </p>

                    <div
                      className="mt-3 rounded-lg p-3"
                      style={{
                        border: '1px solid var(--border-light)',
                        background: 'rgba(0,0,0,0.02)',
                      }}
                    >
                      <p className="label-mono">Recommended Action</p>
                      <p
                        className="mt-1"
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.875rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {result.interpretation?.recommended_action}
                      </p>
                    </div>
                  </div>

                  <MetricSection
                    title="Risk Flags"
                    subtitle={`${resultFlags.length} flag${resultFlags.length === 1 ? '' : 's'} detected`}
                    open={sectionsOpen.flags}
                    onToggle={() => toggleSection('flags')}
                  >
                    {resultFlags.length === 0 ? (
                      <div
                        className="rounded-md px-3 py-2"
                        style={{
                          background: 'rgba(92,143,104,0.1)',
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.875rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        No significant biomarker flags detected.
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {resultFlags.map((flag, idx) => (
                          <li
                            key={`${flag}-${idx}`}
                            className="rounded-md px-3 py-2"
                            style={{
                              background: idx < 2 ? 'rgba(176,64,64,0.08)' : 'rgba(196,168,79,0.14)',
                              fontFamily: 'var(--font-body)',
                              fontSize: '0.875rem',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {flag}
                          </li>
                        ))}
                      </ul>
                    )}
                  </MetricSection>

                  <MetricSection
                    title="Acoustic Analysis"
                    subtitle="Voice dynamics and fluency features"
                    open={sectionsOpen.acoustic}
                    onToggle={() => toggleSection('acoustic')}
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                        <tbody>
                          {acousticRows.map((row) => (
                            <tr key={row.name}>
                              <td
                                style={{
                                  minWidth: 130,
                                  fontFamily: 'var(--font-body)',
                                  fontSize: '0.8125rem',
                                  color: 'var(--text-secondary)',
                                  paddingRight: 8,
                                }}
                              >
                                {row.name}
                              </td>
                              <td style={{ width: '100%', paddingRight: 8 }}>
                                <div
                                  style={{
                                    width: '100%',
                                    height: 8,
                                    borderRadius: 999,
                                    background: 'rgba(0,0,0,0.08)',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${row.pct}%`,
                                      height: '100%',
                                      background:
                                        row.status === 'bad'
                                          ? 'var(--risk-critical)'
                                          : row.status === 'warn'
                                            ? 'var(--risk-medium)'
                                            : 'var(--accent-primary)',
                                    }}
                                  />
                                </div>
                              </td>
                              <td
                                style={{
                                  whiteSpace: 'nowrap',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '0.75rem',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {row.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </MetricSection>

                  <MetricSection
                    title="Lexical Analysis"
                    subtitle="Transcript and language features"
                    open={sectionsOpen.lexical}
                    onToggle={() => toggleSection('lexical')}
                  >
                    <p className="label-mono" style={{ marginBottom: 8 }}>
                      Detected Language: {(result.lexico_semantic?.detected_language || 'unknown').toUpperCase()}
                    </p>

                    <blockquote
                      className="rounded-lg px-3 py-3"
                      style={{
                        marginBottom: 14,
                        background: 'rgba(0,0,0,0.03)',
                        borderLeft: '3px solid var(--accent-primary)',
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.875rem',
                        color: 'var(--text-primary)',
                        lineHeight: 1.6,
                      }}
                    >
                      {transcriptText || 'Transcript unavailable.'}
                    </blockquote>

                    <div className="overflow-x-auto">
                      <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                        <tbody>
                          {lexicalRows.map((row) => (
                            <tr key={row.name}>
                              <td
                                style={{
                                  minWidth: 130,
                                  fontFamily: 'var(--font-body)',
                                  fontSize: '0.8125rem',
                                  color: 'var(--text-secondary)',
                                  paddingRight: 8,
                                }}
                              >
                                {row.name}
                              </td>
                              <td style={{ width: '100%', paddingRight: 8 }}>
                                <div
                                  style={{
                                    width: '100%',
                                    height: 8,
                                    borderRadius: 999,
                                    background: 'rgba(0,0,0,0.08)',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${row.pct}%`,
                                      height: '100%',
                                      background:
                                        row.status === 'bad'
                                          ? 'var(--risk-critical)'
                                          : row.status === 'warn'
                                            ? 'var(--risk-medium)'
                                            : 'var(--accent-primary)',
                                    }}
                                  />
                                </div>
                              </td>
                              <td
                                style={{
                                  whiteSpace: 'nowrap',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '0.75rem',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {row.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </MetricSection>

                  <MetricSection
                    title="MFCC Vector"
                    subtitle="13-dimensional spectral coefficients"
                    open={sectionsOpen.mfcc}
                    onToggle={() => toggleSection('mfcc')}
                  >
                    {mfccValues.length === 0 ? (
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '0.8125rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        No MFCC coefficients were returned.
                      </p>
                    ) : (
                      <>
                        <p
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: '0.8125rem',
                            color: 'var(--text-muted)',
                            marginBottom: 10,
                          }}
                        >
                          C1 captures overall energy, while C2-C13 capture finer spectral shape details.
                        </p>

                        <div
                          className="rounded-lg px-3 pt-3 pb-2"
                          style={{
                            background: 'rgba(0,0,0,0.03)',
                            marginBottom: 12,
                          }}
                        >
                          <div
                            className="gap-1"
                            style={{
                              display: 'grid',
                              gridTemplateColumns: `repeat(${mfccValues.length}, minmax(0, 1fr))`,
                              alignItems: 'end',
                            }}
                          >
                            {mfccValues.map((value, idx) => (
                              <div key={`mfcc-${idx}`} className="flex flex-col items-center gap-1">
                                <div
                                  style={{
                                    width: '100%',
                                    maxWidth: 16,
                                    height: Math.max((Math.abs(Number(value || 0)) / maxMfccAbs) * 62, 3),
                                    borderRadius: 3,
                                    background:
                                      idx % 4 === 0
                                        ? 'var(--accent-primary)'
                                        : idx % 4 === 1
                                          ? 'var(--accent-light)'
                                          : idx % 4 === 2
                                            ? 'var(--risk-medium)'
                                            : 'var(--risk-high)',
                                    opacity: 0.85,
                                  }}
                                />
                                <span
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.625rem',
                                    color: 'var(--text-muted)',
                                  }}
                                >
                                  C{idx + 1}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                            <tbody>
                              {mfccValues.map((value, idx) => (
                                <tr key={`mfcc-row-${idx}`}>
                                  <td
                                    style={{
                                      minWidth: 120,
                                      fontFamily: 'var(--font-body)',
                                      fontSize: '0.8125rem',
                                      color: 'var(--text-secondary)',
                                      paddingRight: 8,
                                    }}
                                  >
                                    MFCC C{idx + 1}
                                  </td>
                                  <td style={{ width: '100%', paddingRight: 8 }}>
                                    <div
                                      style={{
                                        width: '100%',
                                        height: 8,
                                        borderRadius: 999,
                                        background: 'rgba(0,0,0,0.08)',
                                        overflow: 'hidden',
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: `${(Math.abs(Number(value || 0)) / maxMfccAbs) * 100}%`,
                                          height: '100%',
                                          background:
                                            idx % 4 === 0
                                              ? 'var(--accent-primary)'
                                              : idx % 4 === 1
                                                ? 'var(--accent-light)'
                                                : idx % 4 === 2
                                                  ? 'var(--risk-medium)'
                                                  : 'var(--risk-high)',
                                        }}
                                      />
                                    </div>
                                  </td>
                                  <td
                                    style={{
                                      whiteSpace: 'nowrap',
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: '0.75rem',
                                      color: Number(value || 0) < 0 ? 'var(--risk-high)' : 'var(--risk-low)',
                                    }}
                                  >
                                    {Number(value || 0).toFixed(3)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </MetricSection>
                </>
              )}
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
