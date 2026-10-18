/* fr.js — French interface for the absence sheet.
 *
 * The application itself is written in Arabic. This file adds a language switch:
 *   - LANG        'ar' (default) or 'fr'. Remembered in localStorage; ?lang=fr|ar forces it;
 *                 the etablissement-* addresses open in French the first time.
 *   - setLang(l)  stores the choice and reloads the page.
 *   - T(s)        translates one string (used for text that does not go through the page).
 *   - Th(html)    translates the text of an HTML / SVG string (print sheets, charts).
 *   - In French the page is switched to left-to-right and a MutationObserver translates every
 *     Arabic text, placeholder, title and alt that the application puts on the screen.
 * Names typed by the users (students, classes, subjects, teachers) are never in the
 * dictionary, so they stay as they are. In Arabic mode nothing here changes the page.
 */
(function (w) {
  'use strict';

  /* ---------- language choice ---------- */
  var LANG = 'ar';
  try {
    var q = (w.location.search.match(/[?&]lang=(fr|ar)\b/) || [])[1];
    var saved = null;
    try { saved = w.localStorage.getItem('lang'); } catch (e) {}
    if (q) { LANG = q; try { w.localStorage.setItem('lang', q); } catch (e) {} }
    else if (saved === 'fr' || saved === 'ar') LANG = saved;
    else if (/^etablissement-/i.test(w.location.hostname)) LANG = 'fr';
  } catch (e) {}

  function setLang(l) {
    try { w.localStorage.setItem('lang', l); } catch (e) {}
    w.location.reload();
  }

  var AR = /[؀-ۿ]/;

  if (LANG !== 'fr') {
    w.LANG = 'ar';
    w.T = function (s) { return s; };
    w.Th = function (s) { return s; };
    w.setLang = setLang;
    return;
  }

  /* ---------- helpers ---------- */
  var MON = 'يناير|فبراير|مارس|أبريل|ماي|يونيو|يوليوز|غشت|شتنبر|أكتوبر|نونبر|دجنبر';
  var DAYRE = 'الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة';
  var SHRE = 'صباحا|مساء';
  var HRS = '(?:ساعة واحدة|ساعتان|\\d+ ساعات|\\d+ ساعة)';
  function pl(n, one, many) { n = +n; return n + ' ' + (n > 1 ? many : one); }

  /* ---------- exact strings ---------- */
  var EXACT = {
    // titles, login
    'ورقة ضبط الغياب الأسبوعية': "Feuille hebdomadaire de suivi des absences",
    'جارٍ التحميل…': 'Chargement…',
    'تتبع غياب التلاميذ': "Suivi des absences des élèves",
    'سجّلوا الدخول للاطلاع على البيانات': 'Connectez-vous pour consulter les données',
    'دخول': 'Se connecter',
    'إنشاء حساب': 'Créer un compte',
    'إنشاء الحساب': 'Créer le compte',
    'البريد الإلكتروني': 'Adresse e-mail',
    'كلمة المرور': 'Mot de passe',
    'أعيدوا كتابة كلمة المرور': 'Confirmez le mot de passe',
    'حسابات الاطلاع الجديدة تحتاج إلى موافقة المسؤول قبل الدخول. التعديل مخصّص للمسؤول.': "Les nouveaux comptes de consultation doivent être approuvés par l'administrateur avant de pouvoir se connecter. La modification est réservée à l'administrateur.",
    'سيُرسَل طلب حساب للاطلاع فقط (كلمة المرور 8 أحرف على الأقل). لا يعمل الحساب إلا بعد موافقة المسؤول.': "Une demande de compte en lecture seule sera envoyée (mot de passe de 8 caractères minimum). Le compte ne fonctionne qu'après l'approbation de l'administrateur.",
    'كلمتا المرور غير متطابقتين': 'Les deux mots de passe ne correspondent pas',
    'جارٍ التحقق…': 'Vérification…',
    'تم إرسال طلبكم إلى المسؤول.': "Votre demande a été envoyée à l'administrateur.",
    'تعذر إتمام العملية، أعيدوا المحاولة': "Impossible de terminer l'opération, veuillez réessayer",
    'تعذر الاتصال بالخادم، تأكدوا من الإنترنت وأعيدوا المحاولة': "Impossible de joindre le serveur : vérifiez votre connexion Internet et réessayez",
    'انتهت الجلسة، سجّلوا الدخول من جديد': 'La session a expiré, veuillez vous reconnecter',
    'حسابكم لا يملك صلاحية التعديل، لم يُحفظ هذا التغيير.': "Votre compte n'a pas le droit de modifier : ce changement n'a pas été enregistré.",
    'الخادم غير مهيّأ بعد': "Le serveur n'est pas encore configuré",

    // server messages (api/*.js)
    'حسابكم للاطلاع فقط، ولا يملك صلاحية التعديل': "Votre compte est en lecture seule et n'a pas le droit de modifier",
    'هذه الصفحة مخصّصة للمسؤول': "Cette page est réservée à l'administrateur",
    'لا يوجد حساب بهذا البريد (ربما عولج الطلب من قبل)': "Aucun compte avec cette adresse (la demande a peut-être déjà été traitée)",
    'هذا الحساب مقبول من قبل، استعملوا «إزالة»': 'Ce compte est déjà approuvé, utilisez « Retirer »',
    'طلب غير صالح': 'Requête non valide',
    'محاولات كثيرة، انتظروا 15 دقيقة ثم أعيدوا المحاولة': 'Trop de tentatives : attendez 15 minutes puis réessayez',
    'البريد الإلكتروني أو كلمة المرور غير صحيحة': 'Adresse e-mail ou mot de passe incorrect',
    'حسابكم في انتظار موافقة المسؤول. سيتمكّن من الدخول بعد قبول طلبكم.': "Votre compte est en attente d'approbation par l'administrateur. Vous pourrez vous connecter une fois votre demande acceptée.",
    'محاولات كثيرة، أعيدوا المحاولة لاحقًا': 'Trop de tentatives : réessayez plus tard',
    'البريد الإلكتروني غير صالح': 'Adresse e-mail non valide',
    'هذا البريد مخصّص للمسؤول، استعملوه من تبويب «دخول»': "Cette adresse est réservée à l'administrateur : utilisez l'onglet « Se connecter »",
    'كلمة المرور يجب أن تكون بين 8 و128 حرفًا': 'Le mot de passe doit comporter entre 8 et 128 caractères',
    'عدد طلبات الحسابات المعلّقة كبير، أخبروا المسؤول ليعالجها ثم أعيدوا المحاولة': "Le nombre de demandes en attente est trop élevé : prévenez l'administrateur pour qu'il les traite, puis réessayez",
    'يوجد حساب أو طلب بهذا البريد بالفعل. إن كان طلبكم معلّقا فانتظروا موافقة المسؤول، وإلا استعملوا تبويب «دخول»': "Un compte ou une demande existe déjà avec cette adresse. Si votre demande est en attente, patientez jusqu'à l'approbation de l'administrateur ; sinon utilisez l'onglet « Se connecter »",
    'تم إرسال طلبكم إلى المسؤول. يمكنكم الدخول بعد موافقته عليه.': "Votre demande a été envoyée à l'administrateur. Vous pourrez vous connecter après son approbation.",
    'خطأ في الخادم، أعيدوا المحاولة': 'Erreur du serveur, veuillez réessayer',
    'صورة غير صالحة أو كبيرة جدا': 'Image non valide ou trop volumineuse',

    // header
    '— ورقة الغياب الأسبوعية': "— Feuille d'absence hebdomadaire",
    'تعديل اسم المؤسسة': "Modifier le nom de l'établissement",
    '🔄 جاري التحقق من إمكانية المشاركة بين المكاتب…': '🔄 Vérification du partage entre les bureaux…',
    '🟢 متصل — تعديلاتكم تظهر فورًا لدى كل المستخدمين': '🟢 Connecté — vos modifications apparaissent immédiatement chez tous les utilisateurs',
    '🟢 متصل — تُحدَّث البيانات تلقائيًا (تسجيل غياب حصص اليوم)': 'Connecté — mise à jour automatique (saisie des absences du jour)',
    '🟢 متصل — تُحدَّث البيانات تلقائيًا (تسجيل غياب حصص اليوم)': '🟢 Connecté — mise à jour automatique (saisie des absences du jour)',
    '🟢 متصل — تُحدَّث البيانات تلقائيًا (اطلاع فقط)': '🟢 Connecté — les données se mettent à jour automatiquement (lecture seule)',
    '🔴 تعذر الاتصال بالخادم — تأكدوا من اتصال هذا الجهاز بالإنترنت وأعيدوا المحاولة': "🔴 Impossible de joindre le serveur — vérifiez la connexion Internet de cet appareil et réessayez",
    '⚪ غير متصل — تعذر تحميل البيانات من الخادم': '⚪ Hors ligne — impossible de charger les données du serveur',
    'من': 'Du',
    'إلى': 'Au',
    'خروج': 'Déconnexion',
    '📊 الإحصائيات': '📊 Statistiques',
    '👥 الموافقة على حساب جديد': '👥 Approuver un nouveau compte',
    'الموافقة على طلبات حسابات الاطلاع': 'Approuver les demandes de comptes de consultation',
    'طباعة': 'Imprimer',
    'مسؤول': 'Administrateur',
    'اطلاع': 'Consultation',
    'تغيير الشعار': 'Changer le logo',
    'شعار المؤسسة': "Logo de l'établissement",
    '👁️ وضع الاطلاع فقط — حسابكم لا يملك صلاحية التعديل. يمكنكم تصفّح الجدول والإحصائيات وطباعتها.': "👁️ Mode consultation seule — votre compte n'a pas le droit de modifier. Vous pouvez parcourir le tableau et les statistiques et les imprimer.",
    'اسم المؤسسة': "Nom de l'établissement",
    'مؤسسة المثابرة الخاصة': 'Établissement privé La Persévérance',
    'مدرسة المثابرة الخاصة_ابتدائي': 'École privée La Persévérance – Primaire',
    'مدرسة المثابرة الخاصة ابتدائي': 'École privée La Persévérance – Primaire',

    // statistics view bar
    '↩ رجوع إلى الجدول': '↩ Retour au tableau',
    'يومي': 'Jour',
    'أسبوعي': 'Semaine',
    'شهري': 'Mois',
    'حسب الأقسام': 'Par classe',
    'حسب المستويات': 'Par niveau',
    'حسب التلاميذ': 'Par élève',
    '🖨️ طباعة الإحصائيات': '🖨️ Imprimer les statistiques',
    'القسم': 'Classe',
    'المستوى': 'Niveau',
    'المبيان حسب': 'Graphique selon',
    '🖼️ تحميل المبيانات (صورة PNG)': '🖼️ Télécharger les graphiques (image PNG)',
    '📗 تصدير إلى إكسيل': '📗 Exporter vers Excel',
    'كل الأقسام': 'Toutes les classes',
    'كل المستويات': 'Tous les niveaux',
    'ساعات الغياب': "Heures d'absence",
    'عطلة بينية': 'Vacances intermédiaires',
    'نعم، الانتقال إلى الأسبوع التالي': 'Oui, passer à la semaine suivante',
    'منها مبررة': 'Dont justifiées',
    'منها غير مبررة': 'Dont non justifiées',
    'التلاميذ الغائبون': 'Élèves absents',
    'أيام الغياب': "Jours d'absence",
    'أيام الغياب (تلميذ·يوم)': "Jours d'absence (élève·jour)",
    'حسب المستويات الدراسية': 'Par niveau scolaire',
    'الإحصاء الشهري': 'Statistiques mensuelles',
    'الإحصاء الأسبوعي': 'Statistiques hebdomadaires',
    'الإحصاء اليومي': 'Statistiques journalières',
    'التلميذ': 'Élève',
    'عدد الأقسام': 'Nombre de classes',
    'عدد التلاميذ': "Nombre d'élèves",
    'نسبة الغائبين': "Taux d'absents",
    'متوسط الغائبين يوميا': "Moyenne d'absents par jour",
    'المجموع': 'Total',
    'اليوم': 'Jour',
    'التاريخ': 'Date',
    'الإحصائيات': 'Statistiques',
    'التطور اليومي': 'Évolution journalière',
    'لا توجد بيانات مسجّلة لهذا اليوم. تُسجَّل الأيام من الاثنين إلى الجمعة للأسابيع التي حُدّدت تواريخها وأُدخل غيابها.': "Aucune donnée enregistrée pour ce jour. Les jours du lundi au vendredi sont enregistrés pour les semaines dont les dates sont définies et dont les absences sont saisies.",
    'لا توجد أسابيع مسجّلة بعد.': "Aucune semaine enregistrée pour l'instant.",
    'لا توجد بيانات مسجّلة لهذا الشهر.': 'Aucune donnée enregistrée pour ce mois.',
    'لا تتوفر تفاصيل التلاميذ لهذه الفترة لأنها سُجّلت قبل إضافة هذه الميزة. ستتوفر لكل الأسابيع الجديدة.': "Le détail par élève n'est pas disponible pour cette période car elle a été enregistrée avant l'ajout de cette fonction. Il le sera pour toutes les nouvelles semaines.",
    'لا توجد نتائج مطابقة للمرشّحات المختارة.': 'Aucun résultat ne correspond aux filtres choisis.',
    'يعرض المبيان 20 تلميذا الأكثر غيابا فقط، والجدول يضم الجميع.': "Le graphique n'affiche que les 20 élèves les plus absents ; le tableau les contient tous.",
    'تُعرض في هذا الجدول فقط التلاميذ الذين غابوا خلال الفترة، مرتّبين من الأكثر غيابا.': "Ce tableau n'affiche que les élèves absents durant la période, classés du plus absent au moins absent.",
    '«أيام الغياب» = عدد الأيام التي غاب فيها التلميذ ولو لحصة واحدة.': "« Jours d'absence » = nombre de jours où l'élève a été absent, ne serait-ce que pour une séance.",
    '«أيام الغياب» = مجموع عدد التلاميذ الغائبين في كل يوم (تلميذ·يوم).': "« Jours d'absence » = somme du nombre d'élèves absents chaque jour (élève·jour).",
    'لا توجد أسابيع مسجّلة بعد. يُسجَّل الأسبوع تلقائيا بمجرد تحديد تواريخه (من / إلى) في أعلى الصفحة وإدخال الغياب فيه، ثم استعملوا «أسبوع جديد» لبدء الأسبوع التالي.': "Aucune semaine enregistrée pour l'instant. Une semaine est enregistrée automatiquement dès que ses dates (Du / Au) sont définies en haut de la page et que les absences y sont saisies ; utilisez ensuite « Nouvelle semaine » pour commencer la suivante.",
    '🏷️ المستوى الدراسي لكل قسم': '🏷️ Niveau scolaire de chaque classe',
    'يُستنتج المستوى تلقائيا من اسم القسم (مثال: 1AIPC-2 ← 1AIPC). عدّلوه هنا إن كان مختلفا، ويُطبَّق على كل الأسابيع.': "Le niveau est déduit automatiquement du nom de la classe (exemple : 1AIPC-2 → 1AIPC). Modifiez-le ici s'il est différent ; il s'applique à toutes les semaines.",
    'حذف هذا الأسبوع من السجل': "Supprimer cette semaine de l'historique",
    'مفيد إذا سُجّل أسبوع بتاريخ خاطئ.': "Utile si une semaine a été enregistrée avec une mauvaise date.",
    'تعذر حذف الأسبوع، أعيدوا المحاولة.': "Impossible de supprimer la semaine, veuillez réessayer.",
    'تعذر تحميل الإحصائيات، تحقّقوا من الاتصال ثم أعيدوا فتح الصفحة.': "Impossible de charger les statistiques : vérifiez la connexion puis rouvrez la page.",
    'تعذر إنشاء الصورة.': "Impossible de créer l'image.",
    '(الحالي)': '(en cours)',

    // working without internet
    '🟠 دون اتصال — يمكنكم متابعة تسجيل الغياب، وستُرسَل التعديلات تلقائيا عند عودة الإنترنت': '🟠 Hors connexion — vous pouvez continuer à enregistrer les absences ; les modifications seront envoyées automatiquement au retour d\'Internet',
    '🔴 دون اتصال — تُعرض آخر بيانات محفوظة على هذا الجهاز': '🔴 Hors connexion — les dernières données enregistrées sur cet appareil sont affichées',
    'تم تعديل الجدول من جهاز آخر أثناء عملكم دون اتصال، فنسخة هذا الجهاز تختلف عن نسخة الخادم. أيّهما تعتمدون؟': "Le tableau a été modifié depuis un autre appareil pendant que vous travailliez hors connexion : la copie de cet appareil diffère de celle du serveur. Laquelle retenir ?",
    'الاحتفاظ بتعديلات هذا الجهاز (تستبدل نسخة الخادم)': 'Garder les modifications de cet appareil (elles remplacent la copie du serveur)',
    'اعتماد نسخة الخادم (تُحذف تعديلات هذا الجهاز)': 'Retenir la copie du serveur (les modifications de cet appareil sont supprimées)',
    'توجد تعديلات لم تُرسَل إلى الخادم بعد (عمل دون اتصال). الخروج الآن يحذفها نهائيا من هذا الجهاز. هل تريدون الخروج؟': "Des modifications n'ont pas encore été envoyées au serveur (travail hors connexion). Se déconnecter maintenant les supprime définitivement de cet appareil. Voulez-vous vous déconnecter ?",
    'نعم، اخرج وأحذفها': 'Oui, me déconnecter et les supprimer',
    'البقاء': 'Rester',
    'انتهت الجلسة، سجّلوا الدخول من جديد. تعديلاتكم غير المرسلة محفوظة على هذا الجهاز وستُرسَل بعد الدخول.': 'La session a expiré, reconnectez-vous. Vos modifications non envoyées sont conservées sur cet appareil et seront envoyées après la connexion.',
    // catch-up list
    '📚 قائمة التعويض': '📚 Liste de rattrapage',
    '📲 إبلاغ الأولياء': '📲 Informer les parents',
    '📲 إبلاغ': '📲 Informer',
    'إبلاغ ولي الأمر بموعد حصة التعويض': 'Informer les parents de la séance de rattrapage',
    'الساعة': 'Heure',
    'المكان (اختياري)': 'Lieu (facultatif)',
    'مثال: القاعة 3': 'Exemple : salle 3',
    'معاينة الرسالة': 'Aperçu du message',
    'التلاميذ المتغيبون والمواد التي فاتتهم، لبرمجة حصص التعويض والدعم': 'Élèves absents et matières manquées, pour programmer les séances de rattrapage et de soutien',
    'حسب المادة': 'Par matière',
    'حسب التلميذ': 'Par élève',
    'هذا الأسبوع': 'Cette semaine',
    'الأسبوع الماضي': 'Semaine précédente',
    'هذا الشهر': 'Ce mois-ci',
    'الشهر الماضي': 'Le mois dernier',
    'كل الفترة المسجّلة': 'Toute la période enregistrée',
    'فترة مخصّصة': 'Période personnalisée',
    '🖨️ طباعة القائمة': '🖨️ Imprimer la liste',
    'الحد الأدنى للغياب': "Absence minimale",
    'كل المواد': 'Toutes les matières',
    'الساعات': 'Heures',
    'الحصص الفائتة': 'Séances manquées',
    'مجموع الساعات': 'Total des heures',
    'المواد الفائتة': 'Matières manquées',
    'موعد التعويض': 'Date du rattrapage',
    'ملاحظات': 'Remarques',
    'لا يوجد غياب مسجّل في الفترة المختارة.': 'Aucune absence enregistrée pour la période choisie.',
    'تعذر تحميل قائمة التعويض، تحقّقوا من الاتصال ثم أعيدوا فتح الصفحة.': 'Impossible de charger la liste de rattrapage : vérifiez la connexion puis rouvrez la page.',

    // toolbar
    '🖼️ شعار المؤسسة': "🖼️ Logo de l'établissement",
    'تغيير شعار المؤسسة الظاهر في أعلى الصفحة وفي الطباعة': "Changer le logo affiché en haut de la page et à l'impression",
    '🧮 عدد الحصص': '🧮 Nombre de séances',
    'إضافة حصة أو حذفها صباحا أو مساء لتلائم النظام الدراسي للمؤسسة': "Ajouter ou supprimer une séance le matin ou l'après-midi selon l'organisation de l'établissement",
    '⏰ توقيت الحصص': '⏰ Horaires des séances',
    'بداية كل حصة في القسم المعروض، لمنع تسجيل غياب حصة لم يحن وقتها': "Heure de début de chaque séance de la classe affichée, pour empêcher d'enregistrer l'absence d'une séance qui n'a pas encore commencé",
    '⏪ السابق': '⏪ Précédente',
    '⏩ التالي': '⏩ Suivante',
    '📍 الأسبوع الجاري': '📍 Semaine en cours',
    'العودة إلى الأسبوع الجاري بعد عرض الأسبوع السابق': 'Revenir à la semaine en cours après avoir affiché la semaine précédente',
    'بدء الأسبوع التالي: يُحفظ غياب الأسبوع الجاري ثم يُمسح الجدول': "Commencer la semaine suivante : les absences de la semaine en cours sont enregistrées puis le tableau est vidé",
    'عرض الأسبوع السابق لتصحيح غياب سُجّل بالخطأ': 'Afficher la semaine précédente pour corriger une absence enregistrée par erreur',
    'عرض الأسبوع الماضي لتصحيح غياب سُجّل بالخطأ': 'Afficher la semaine précédente pour corriger une absence enregistrée par erreur',
    'حذف المحددين (': 'Supprimer la sélection (',

    // automatic notices / WhatsApp
    '⚡ إشعارات تلقائية لأولياء الأمور — شهر': '⚡ Avis automatiques aux parents — mois :',
    'ساعة غياب واحدة ← إشعار لولي الأمر، وثلاث ساعات ← استدعاء للحضور (المجموع تراكمي خلال الشهر). الرسالة جاهزة، ويكفي الضغط على «إرسال».': "1 heure d'absence → avis au parent ; 3 heures → convocation à se présenter à l'établissement (le total est cumulé sur le mois). Le message est prêt : il suffit de cliquer sur « Envoyer ».",
    '🔔 إشعار أولياء الأمور بالغياب عبر واتساب — قسم': '🔔 Avertir les parents des absences par WhatsApp —',
    'لا توجد إشعارات أو استدعاءات معلّقة': 'Aucun avis ni convocation en attente',
    'استدعاء للحضور': 'Convocation',
    'إشعار بالغياب': "Avis d'absence",
    '📲 إرسال': '📲 Envoyer',
    'تعليمه كمعالَج دون إرسال': 'Marquer comme traité sans envoyer',
    'تم': 'Fait',
    '📲 إرسال الاستدعاء': '📲 Envoyer la convocation',
    '📲 إرسال الإشعار': "📲 Envoyer l'avis",
    '📲 إرسال إشعار': '📲 Envoyer un avis',
    'أدخلوا رقم الهاتف أولا': "Saisissez d'abord le numéro de téléphone",
    'لاحقا': 'Plus tard',
    'لا يوجد تلاميذ عليهم غياب في هذا القسم حاليا': 'Aucun élève absent dans cette classe pour le moment',
    'الرجاء إدخال رقم هاتف ولي الأمر أولا في عمود «هاتف ولي الأمر» أمام اسم التلميذ(ة).': "Veuillez d'abord saisir le numéro de téléphone du parent dans la colonne « Tél. du parent », en face du nom de l'élève.",

    // daily cards
    'عدد ساعات الغياب حسب الحصة (اليوم)': "Heures d'absence par séance (jour)",
    'ساعة غياب، لجميع الأقسام': "heures d'absence, toutes classes confondues",
    'إجمالي غياب الأسبوع': 'Total des absences de la semaine',
    'الغياب حسب المادة': 'Absences par matière',
    'الغياب حسب الأستاذ(ة)': 'Absences par professeur(e)',
    'لم تُدخل بعد رموز المواد': "Aucun code de matière saisi pour l'instant",
    'لم تُدخل بعد أسماء الأساتذة': "Aucun nom de professeur saisi pour l'instant",

    // users dialog
    'حسابات الاطلاع': 'Comptes de consultation',
    'من يسجّل حسابا جديدا من صفحة الدخول لا يستطيع الدخول حتى توافقوا على طلبه هنا. الحسابات المقبولة تطلع على الجدول والإحصائيات فقط دون تعديل، ويمكنكم تحويل أي حساب إلى «أستاذ» ليسجّل الغياب عند النداء في حصص اليوم (وإن كتبتم اسمه كما في الجدول فلن يسجّل إلا في حصصه).': "Toute personne qui crée un compte depuis la page de connexion ne peut pas se connecter tant que vous n'avez pas approuvé sa demande ici. Les comptes approuvés peuvent seulement consulter le tableau et les statistiques, sans rien modifier ; vous pouvez transformer un compte en « professeur » pour qu'il note les absences à l'appel dans les séances du jour (si vous saisissez son nom comme dans le tableau, il ne pourra noter que dans ses propres séances).",
    'إغلاق': 'Fermer',
    'تعذر تحميل القائمة، تحقّقوا من الاتصال وأعيدوا المحاولة.': 'Impossible de charger la liste : vérifiez la connexion et réessayez.',
    'طلبات بانتظار موافقتكم': 'Demandes en attente de votre approbation',
    '✔ قبول': '✔ Accepter',
    '✖ رفض': '✖ Refuser',
    'لا توجد طلبات معلّقة.': 'Aucune demande en attente.',
    'حسابات الاطلاع المقبولة': 'Comptes de consultation approuvés',
    'الحسابات المقبولة': 'Comptes approuvés',
    'أستاذ': 'Prof.',
    'اطلاع': 'Consultation',
    'جعله أستاذا': 'Nommer professeur(e)',
    'حفظ الاسم': 'Enregistrer le nom',
    'إرجاعه إلى اطلاع فقط': 'Remettre en consultation seule',
    'اسم الأستاذ(ة) كما في الجدول (اختياري)': 'Nom du/de la professeur(e) comme dans le tableau (facultatif)',
    'إن كُتب الاسم، لا يسجّل الحساب الغياب إلا في الحصص التي يحمل فيها هذا الاسم': "Si le nom est renseigné, le compte ne peut noter les absences que dans les séances portant ce nom",
    '👩‍🏫 حساب أستاذ(ة) — يمكنكم تسجيل غياب التلاميذ في حصص اليوم بالنقر على خانة الحصة، أو الضغط على «لا أحد» أسفل الحصة إذا لم يتغيب أحد. يعمل التطبيق أيضا عند انقطاع الإنترنت وتُرسَل تسجيلاتكم تلقائيا حين يعود. بقية الجدول للاطلاع فقط.': "👩‍🏫 Compte professeur(e) — vous pouvez noter les absences des élèves dans les séances d'aujourd'hui en touchant la case de la séance, ou appuyer sur « Aucun » sous la séance si personne n'est absent. L'application fonctionne aussi sans Internet : vos saisies sont envoyées automatiquement au retour de la connexion. Le reste du tableau est en consultation seule.",
    'لا يوجد اتصال بالإنترنت: لا يمكن تسجيل الغياب الآن، أعيدوا المحاولة عند عودة الاتصال.': "Pas de connexion Internet : impossible de noter l'absence maintenant, réessayez au retour de la connexion.",
    'تعذر الاتصال بالخادم، لم يُسجَّل الغياب. أعيدوا المحاولة.': "Impossible de joindre le serveur, l'absence n'a pas été enregistrée. Réessayez.",
    'تعذر تسجيل الغياب.': "Impossible d'enregistrer l'absence.",
    'ليس لحسابكم صلاحية تسجيل الغياب.': "Votre compte n'a pas le droit de noter les absences.",
    'الأسبوع غير محدد في الورقة، أخبروا المسؤول.': "La semaine n'est pas définie dans la feuille, prévenez l'administrateur.",
    'هذا الأسبوع عطلة، لا يُسجَّل فيه غياب.': "Cette semaine est une période de vacances : aucune absence n'y est notée.",
    'هذا الغياب مبرَّر من المسؤول ولا يمكن تغييره.': "Cette absence a été justifiée par l'administrateur et ne peut pas être modifiée.",
    'لا يوجد اتصال بالإنترنت: لا يمكن إضافة التلميذ الآن، أعيدوا المحاولة عند عودة الاتصال.': "Pas de connexion Internet : impossible d'ajouter l'élève maintenant, réessayez au retour de la connexion.",
    'تعذر الاتصال بالخادم، لم تتم الإضافة. أعيدوا المحاولة.': "Impossible de joindre le serveur, l'ajout n'a pas été effectué. Réessayez.",
    'تعذرت إضافة التلميذ.': "Impossible d'ajouter l'élève.",
    'اسم التلميذ غير صالح': "Nom d'élève invalide",
    'عدد التلاميذ في القسم بلغ الحد الأقصى': "Le nombre maximal d'élèves de la classe est atteint",
    'هذا التلميذ موجود في القسم بالفعل': "Cet élève existe déjà dans la classe",
    'لا توجد ورقة محفوظة بعد': "Aucune feuille enregistrée pour l'instant",
    'حسابكم للاطلاع فقط، ولا يملك صلاحية تسجيل الغياب': "Votre compte est en consultation seule et ne peut pas noter les absences",
    'تبرير الغياب من اختصاص المسؤول': "La justification des absences relève de l'administrateur",
    'تغيّرت لائحة التلاميذ، حدّثوا الصفحة وأعيدوا المحاولة': "La liste des élèves a changé, actualisez la page et réessayez",
    'هذا الأسبوع عطلة، لا يُسجَّل فيه غياب': "Cette semaine est une période de vacances : aucune absence n'y est notée",
    'يمكن تسجيل غياب حصص اليوم فقط': "Seules les absences des séances d'aujourd'hui peuvent être notées",
    'هذه الحصة ليست من حصصكم': "Cette séance n'est pas l'une des vôtres",
    'هذا الغياب مبرَّر من المسؤول ولا يمكن تغييره': "Cette absence a été justifiée par l'administrateur et ne peut pas être modifiée",
    'الأسبوع غير محدد في الورقة': "La semaine n'est pas définie dans la feuille",
    'القسم غير موجود': 'Classe introuvable',
    'هذه الحصة لم يحن وقتها بعد': "Cette séance n'a pas encore commencé",
    // roll call «لا أحد» + teacher without internet
    'لا أحد': 'Aucun',
    '✅ لا أحد': '✅ Aucun',
    'تمّ النداء ولا غائب في حصتكم الحالية': "L'appel est fait et personne n'est absent dans votre séance en cours",
    'هل قام الأساتذة بالنداء؟': "Les professeurs ont-ils fait l'appel ?",
    'تأكيد «لا أحد»': 'Confirmer « Aucun »',
    'لا توجد الآن حصة من حصصكم قيد الانعقاد في هذا القسم. «لا أحد» يخص حصة اليوم التي بدأت وهي من حصصكم.': "Aucune de vos séances n'est en cours dans cette classe. « Aucun » concerne une séance d'aujourd'hui, commencée, qui est la vôtre.",
    'سُجّل غياب في حصتكم الحالية، فلا يصحّ التصريح بأنه «لا أحد».': "Une absence est enregistrée dans votre séance en cours : on ne peut pas déclarer « Aucun absent ».",
    '✓ لا أحد': '✓ Aucun',
    '✅ متابعة النداء': "✅ Suivi de l'appel",
    'متابعة النداء': "Suivi de l'appel",
    'هل قام الأساتذة بالنداء؟ الحصص التي سُجّل فيها غياب أو «لا أحد» والحصص بلا نداء': "Les professeurs ont-ils fait l'appel ? Séances avec absence ou « Aucun absent », et séances sans appel",
    'لا أحد — اضغطوا للإلغاء': 'Aucun absent — touchez pour annuler',
    'تمّ النداء ولا غائب في هذه الحصة': "L'appel est fait et personne n'est absent dans cette séance",
    'لم يُسجَّل نداء ولا «لا أحد» في هذه الحصة': "Aucun appel enregistré (ni absence, ni « Aucun absent ») dans cette séance",
    'اليوم فقط': "Aujourd'hui seulement",
    'كل الأسبوع': 'Toute la semaine',
    'مع غياب:': 'Avec absence :',
    '«لا أحد»:': '« Aucun absent » :',
    'بلا نداء:': 'Sans appel :',
    'حصص بلا نداء مسجَّل': "Séances sans appel enregistré",
    'تصريحات «لا أحد»': 'Déclarations « Aucun absent »',
    'الحصة': 'Séance',
    'لا توجد حصص بلا نداء في هذه الفترة.': "Aucune séance sans appel sur cette période.",
    'لا توجد حصص بدأت بعد في هذه الفترة.': "Aucune séance n'a encore commencé sur cette période.",
    'نعم، ألغِ': 'Oui, annuler',
    'إبقاء': 'Garder',
    'سُجّل غياب في هذه الحصة، فلا يصحّ التصريح بأنه «لا أحد».': "Une absence est enregistrée dans cette séance : on ne peut pas déclarer « Aucun absent ».",
    'سُجّل غياب في هذه الحصة، فلا يصحّ التصريح بأنه «لا أحد»': "Une absence est enregistrée dans cette séance : on ne peut pas déclarer « Aucun absent »",
    'ساعة الجهاز غير صحيحة، صحّحوا التاريخ والوقت ثم أعيدوا المحاولة': "L'horloge de l'appareil est incorrecte : corrigez la date et l'heure puis réessayez",
    'مضى وقت طويل على هذا التسجيل (أكثر من 18 ساعة) فلم يُقبل. أخبروا المسؤول ليسجّله.': "Cette saisie date de plus de 18 heures : elle n'a pas été acceptée. Informez l'administrateur pour qu'il l'enregistre.",
    'رفض الخادم هذا التسجيل.': 'Le serveur a refusé cette saisie.',
    'التلميذ(ة) لم يعد في لائحة القسم.': "L'élève ne figure plus dans la liste de la classe.",
    'حصة غير موجودة': 'Séance introuvable',
    'خطأ في الخادم، أعيدوا المحاولة': 'Erreur du serveur, veuillez réessayer',
    'إزالة': 'Retirer',
    'لا توجد حسابات مقبولة بعد.': "Aucun compte approuvé pour l'instant.",
    'تعذر تنفيذ العملية، أعيدوا المحاولة.': "Impossible d'effectuer l'opération, veuillez réessayer.",
    'تعذر الاتصال بالخادم.': 'Impossible de joindre le serveur.',

    // logo dialog
    'معاينة الشعار': 'Aperçu du logo',
    'اختاروا صورة الشعار من هذا الجهاز (png أو jpg أو webp). تُصغَّر الصورة تلقائيا، ويظهر الشعار الجديد لدى كل المستخدمين وفي الطباعة.': "Choisissez l'image du logo sur cet appareil (png, jpg ou webp). L'image est réduite automatiquement et le nouveau logo apparaît chez tous les utilisateurs et à l'impression.",
    '📁 اختيار صورة': '📁 Choisir une image',
    'حفظ الشعار': 'Enregistrer le logo',
    'استرجاع الشعار الأصلي': "Rétablir le logo d'origine",
    'تعذرت قراءة هذه الصورة، جرّبوا ملفا آخر.': 'Impossible de lire cette image, essayez un autre fichier.',
    'الصورة معقدة جدا، اختاروا شعارا أبسط أو أصغر حجما.': 'Image trop complexe : choisissez un logo plus simple ou plus petit.',
    'اختاروا ملف صورة بصيغة png أو jpg أو webp.': 'Choisissez un fichier image au format png, jpg ou webp.',
    'حجم الصورة كبير جدا، اختاروا صورة أصغر.': 'Image trop volumineuse, choisissez-en une plus petite.',
    'هذه معاينة الشعار الجديد. اضغطوا «حفظ الشعار» لاعتماده.': "Voici l'aperçu du nouveau logo. Cliquez sur « Enregistrer le logo » pour l'adopter.",
    'تعذرت معالجة الصورة.': "Impossible de traiter l'image.",
    'تعذر حفظ الشعار، تحقّقوا من الاتصال وأعيدوا المحاولة.': "Impossible d'enregistrer le logo : vérifiez la connexion et réessayez.",
    'جارٍ الحفظ…': 'Enregistrement…',
    'سيُسترجع الشعار الأصلي للتطبيق لدى كل المستخدمين. المتابعة؟': "Le logo d'origine de l'application sera rétabli chez tous les utilisateurs. Continuer ?",
    'نعم، استرجعوه': 'Oui, le rétablir',

    // import
    'استيراد لائحة تلاميذ من إكسيل': "Importer une liste d'élèves depuis Excel",
    'الورقة:': 'Feuille :',
    '📥 استيراد لائحة من إكسيل': '📥 Importer une liste depuis Excel',
    'تعذر قراءة الملف. تأكدوا أنه ملف إكسيل صالح.': "Impossible de lire le fichier. Vérifiez qu'il s'agit d'un fichier Excel valide.",
    'اعتبار هذا الصف عنوانًا (البيانات تبدأ بعده)': "Considérer cette ligne comme l'en-tête (les données commencent après)",
    'اضغطوا على رأس أحد الأعمدة أدناه لاختيار عمود أسماء التلاميذ (ويمكنكم الضغط على رقم الصف لتحديد صف العناوين)': "Cliquez sur l'en-tête d'une colonne ci-dessous pour choisir la colonne des noms des élèves (vous pouvez aussi cliquer sur un numéro de ligne pour indiquer la ligne des en-têtes)",
    'استبدال اللائحة الحالية': 'Remplacer la liste actuelle',
    'هذا الأسبوع مؤرشف قبل إضافة التفاصيل، فلا يمكن إعادة عرضه. ابتداءً من الأسابيع الجديدة يتوفر عرضها كاملة.': "Cette semaine a été archivée avant l'ajout des détails : elle ne peut pas être réaffichée. Les nouvelles semaines pourront l'être en entier.",
    'تعذر حفظ الأسبوع المعروض قبل التبديل، تحقّقوا من الاتصال وأعيدوا المحاولة. لم يتغيّر شيء.': "Impossible d'enregistrer la semaine affichée avant de changer, vérifiez la connexion et réessayez. Rien n'a changé.",
    'عرض أسبوع فارغ بهذا التاريخ': 'Afficher une semaine vide à cette date',
    'تغيير التاريخ فقط (تبقى البيانات الحالية)': 'Changer seulement la date (les données actuelles restent)',
    'تحديث اللائحة مع الاحتفاظ بالغياب والهواتف': 'Mettre à jour la liste en conservant absences et téléphones',
    'استبدال اللائحة (يمسح الغياب والهواتف)': 'Remplacer la liste (efface absences et téléphones)',
    'حذف غير الموجودين': 'Supprimer ceux qui ne sont pas dans le fichier',
    'إبقاؤهم في آخر اللائحة': 'Les garder à la fin de la liste',
    'نعم، امسح كل شيء': 'Oui, tout effacer',
    '🕘 النسخ الاحتياطية': '🕘 Sauvegardes',
    'نسخ احتياطية تلقائية للورقة، لاسترجاع الغياب والهواتف إن ضاعت بخطأ': 'Sauvegardes automatiques de la feuille, pour récupérer absences et téléphones perdus par erreur',
    'النسخ الاحتياطية': 'Sauvegardes',
    'يحفظ الخادم نسخة تلقائيا قبل أي حفظ يُضيّع دفعة واحدة كثيرا من الغياب أو الهواتف أو التلاميذ (كاستبدال اللائحة أو الحذف الجماعي أو بدء أسبوع جديد)، وكل 12 ساعة على الأكثر. يُحتفظ بآخر 15 نسخة. «الاسترجاع الجزئي» يُرجع الغياب (إن كان الأسبوع نفسه) والهواتف لتلاميذ اللائحة الحالية دون المساس بغير ذلك، و«الاسترجاع الكامل» يعيد الورقة كلها كما كانت.': "Le serveur garde une copie automatiquement avant toute sauvegarde qui fait perdre d'un coup beaucoup d'absences, de téléphones ou d'élèves (remplacement de la liste, suppression groupée, nouvelle semaine), et au plus toutes les 12 heures. Les 15 dernières copies sont conservées. « Restauration partielle » rend aux élèves de la liste actuelle leurs absences (si c'est la même semaine) et leurs téléphones sans toucher au reste ; « Restauration complète » remet toute la feuille comme elle était.",
    'حفظ نسخة الآن': 'Sauvegarder maintenant',
    'جارٍ التحميل…': 'Chargement…',
    'تعذر تحميل النسخ، تحقّقوا من الاتصال وأعيدوا المحاولة.': 'Impossible de charger les sauvegardes, vérifiez la connexion et réessayez.',
    'لا توجد نسخ بعد. ستُحفظ أول نسخة تلقائيا عند أول حفظ لاحق.': "Aucune sauvegarde pour l'instant. La première sera faite automatiquement à la prochaine sauvegarde.",
    'استرجاع جزئي (الغياب والهواتف)': 'Restauration partielle (absences et téléphones)',
    'استرجاع كامل': 'Restauration complète',
    'نعم، استرجاع كامل': 'Oui, restauration complète',
    'نعم، استرجاع جزئي': 'Oui, restauration partielle',
    'تعذر حفظ النسخة، أعيدوا المحاولة.': 'Impossible de sauvegarder, réessayez.',
    'تعذر الاسترجاع، أعيدوا المحاولة.': 'Impossible de restaurer, réessayez.',
    'تمّ استرجاع الورقة كاملة.': 'La feuille complète a été restaurée.',
    'هذه النسخة لم تعد موجودة': "Cette sauvegarde n'existe plus",
    'إن كانت اللائحة هي نفسها تقريبا فاستعملوا «تحديث اللائحة مع الاحتفاظ بالغياب والهواتف».': "Si la liste est à peu près la même, utilisez « Mettre à jour la liste en conservant absences et téléphones ».",
    'إضافة إلى اللائحة الحالية': 'Ajouter à la liste actuelle',
    'إلغاء': 'Annuler',

    // generic dialogs
    'تأكيد الحذف': 'Confirmer la suppression',
    'حسنًا': 'OK',
    'حفظ': 'Enregistrer',

    // class tabs
    'تعديل اسم/رقم القسم': 'Modifier le nom / numéro de la classe',
    'حذف القسم': 'Supprimer la classe',
    '+ قسم جديد': '+ Nouvelle classe',
    'تعديل اسم/رقم القسم:': 'Modifier le nom / numéro de la classe :',
    'اسم/رقم القسم الجديد:': 'Nom / numéro de la nouvelle classe :',
    'يوجد قسم آخر بنفس الاسم بالفعل، الرجاء اختيار اسم مختلف.': 'Une autre classe porte déjà ce nom, veuillez en choisir un autre.',
    'يوجد قسم بنفس الاسم بالفعل.': 'Une classe porte déjà ce nom.',
    'لا يمكن حذف القسم الوحيد المتبقي.': 'Impossible de supprimer la seule classe restante.',
    'تعديل اسم المؤسسة:': "Modifier le nom de l'établissement :",

    // the table
    'م': 'N°',
    'الاسم الكامل': 'Nom complet',
    'هاتف ولي الأمر': 'Tél. du parent',
    'هل الغياب مبرر أم غير مبرر؟': "L'absence est-elle justifiée ou non justifiée ?",
    'غياب مبرر': 'Absence justifiée',
    'غياب غير مبرر': 'Absence non justifiée',
    'تسجيل غياب غير مبرر': 'Enregistrer une absence non justifiée',
    'تسجيل غياب مبرر': 'Enregistrer une absence justifiée',
    'تحويله إلى مبرر': 'Passer en absence justifiée',
    'تحويله إلى غير مبرر': 'Passer en absence non justifiée',
    'المادة': 'Matière',
    'الأستاذ(ة)': 'Professeur(e)',
    'حذف التلميذ': "Supprimer l'élève",
    'غ': 'A',
    'عدد الغياب في الحصة': "Nombre d'absences par séance",
    'أيام الأسبوع والحصص': 'Jours de la semaine et séances',
    'اسم التلميذ الجديد': "Nom du nouvel élève",
    'إضافة تلميذ': 'Ajouter un élève',
    'مجموع غياب القسم في كل حصة': "Total des absences de la classe par séance",
    'مجموع': 'Total',
    'الاثنين': 'Lundi', 'الثلاثاء': 'Mardi', 'الأربعاء': 'Mercredi', 'الخميس': 'Jeudi', 'الجمعة': 'Vendredi',
    'صباحا': 'matin', 'مساء': 'après-midi',
    'المتابعة؟': 'Continuer ?',

    // periods / times / new week
    'نعم، احذفوا الحصة': 'Oui, supprimer la séance',
    'نعم، ابدأ أسبوعا جديدا': 'Oui, commencer une nouvelle semaine',
    'نعم، تابعوا': 'Oui, continuer',
    'تعذر حفظ الأسبوع الحالي في السجل، تحقّقوا من الاتصال وأعيدوا المحاولة. لم يتغيّر شيء.': "Impossible d'enregistrer la semaine en cours dans l'historique : vérifiez la connexion et réessayez. Rien n'a changé.",
    'تعذر حفظ الأسبوع المعروض قبل التبديل، تحقّقوا من الاتصال وأعيدوا المحاولة. لم يتغيّر شيء.': "Impossible d'enregistrer la semaine affichée avant le changement : vérifiez la connexion et réessayez. Rien n'a changé.",
    'أنتم تعرضون الأسبوع السابق. اضغطوا أولا على «الأسبوع الجاري» قبل الانتقال إلى «التالي».': "Vous affichez la semaine précédente. Cliquez d'abord sur « Semaine en cours » avant de passer à « Suivante ».",
    'حدّدوا أولا تواريخ الأسبوع الحالي (من / إلى) في أعلى الصفحة، حتى يُحفظ غيابه في سجل الإحصائيات.': "Définissez d'abord les dates de la semaine en cours (Du / Au) en haut de la page, afin que ses absences soient enregistrées dans l'historique des statistiques.",
    'حدّدوا أولا تواريخ الأسبوع الحالي (من / إلى).': "Définissez d'abord les dates de la semaine en cours (Du / Au).",
    'لا يوجد أسبوع سابق في سجل الإحصائيات.': "Il n'y a pas de semaine précédente dans l'historique des statistiques.",
    'الأسبوع السابق مؤرشف قبل إضافة التفاصيل، فلا يمكن إعادة عرضه للتعديل. ابتداءً من الأسبوع القادم سيتوفر الرجوع كاملا.': "La semaine précédente a été archivée avant l'ajout des détails : elle ne peut pas être réaffichée pour correction. À partir de la semaine prochaine, le retour sera complet.",
    'تغيّرت القائمة قبل التأكيد، أعيدوا المحاولة.': 'La liste a changé avant la confirmation, veuillez réessayer.',
    'تأكيد تسجيل الغياب': "Confirmer l'enregistrement de l'absence",
    'تأكيد حذف الغياب': "Confirmer la suppression de l'absence",
    '🗄️ أرشفة الموسم': "🗄️ Archiver l'année",
    'حفظ غياب الموسم الدراسي كاملا في الأرشيف وبدء موسم جديد': "Enregistrer dans l'archive les absences de toute l'année scolaire et commencer une nouvelle année",
    'تعديل الموسم الدراسي': "Modifier l'année scolaire",
    'الموسم': "Année",
    '📚 المواسم المؤرشفة': "📚 Années archivées",
    '🗑️ حذف هذا الموسم من الأرشيف': "🗑️ Supprimer cette année de l'archive",
    'لا توجد مواسم مؤرشفة بعد.': "Aucune année n'a encore été archivée.",
    'الموسم الدراسي (مثال: 2026/2027):': "Année scolaire (exemple : 2026/2027) :",
    'صيغة الموسم غير صحيحة. اكتبوها هكذا: 2026/2027 (السنة الثانية تساوي الأولى + 1).': "Format de l'année incorrect. Écrivez-la ainsi : 2026/2027 (la seconde année est la première + 1).",
    'صيغة الموسم غير صحيحة، اكتبوها هكذا: 2026/2027': "Format de l'année incorrect, écrivez-la ainsi : 2026/2027",
    'لا توجد أسابيع مسجّلة لأرشفتها.': "Aucune semaine enregistrée à archiver.",
    'أنتم تعرضون الأسبوع السابق. اضغطوا أولا على «الأسبوع الجاري» ثم أعيدوا أرشفة الموسم.': "Vous affichez la semaine précédente. Cliquez d'abord sur « Semaine en cours », puis recommencez l'archivage de l'année.",
    'تعذر حفظ الجدول قبل الأرشفة، تحقّقوا من الاتصال وأعيدوا المحاولة. لم يتغيّر شيء.': "Impossible d'enregistrer le tableau avant l'archivage, vérifiez la connexion et réessayez. Rien n'a été modifié.",
    'تعذر الاتصال بالخادم لأرشفة الموسم، أعيدوا المحاولة. لم يتغيّر شيء.': "Impossible de joindre le serveur pour archiver l'année, réessayez. Rien n'a été modifié.",
    'تعذرت أرشفة الموسم، أعيدوا المحاولة. لم يتغيّر شيء.': "L'archivage de l'année a échoué, réessayez. Rien n'a été modifié.",
    'تعذر تحميل أرشيف الموسم، تحقّقوا من الاتصال وأعيدوا المحاولة.': "Impossible de charger l'archive de l'année, vérifiez la connexion et réessayez.",
    'تعذر حذف الموسم، أعيدوا المحاولة.': "Impossible de supprimer l'année, réessayez.",
    'تبقى لوائح التلاميذ والأقسام والمواد والتوقيت كما هي، وتحدّدون تواريخ الأسبوع الأول من جديد.': "Les listes d'élèves, les classes, les matières et les horaires restent inchangés ; vous fixerez de nouveau les dates de la première semaine.",
    'لا يمكن التراجع عن مسح الغياب من الجدول.': "L'effacement des absences du tableau est irréversible.",
    'موسم مؤرشف، للاطلاع والطباعة فقط': "année archivée, consultation et impression uniquement",
    '📅 استيراد التنظيم التربوي': "📅 Importer l'organisation pédagogique",
    'ملء اسم المادة واسم الأستاذ لكل قسم من ملف إكسيل «التنظيم التربوي»': "Remplir la matière et le professeur de chaque classe à partir du fichier Excel « organisation pédagogique »",
    'استيراد التنظيم التربوي من إكسيل': "Importer l'organisation pédagogique depuis Excel",
    'القسم في الملف': "Classe dans le fichier",
    'الحصص المعبّأة': "Séances remplies",
    'يُطبَّق على': "Appliquer à",
    '⛔ تجاهل هذا القسم': "⛔ Ignorer cette classe",
    'سيُستبدل اسم المادة واسم الأستاذ في كل حصص الأقسام المحددة، وتُفرَّغ الحصص الفارغة في الملف. لا يتغير الغياب ولا لوائح التلاميذ.': "La matière et le professeur seront remplacés dans toutes les séances des classes choisies ; les séances vides du fichier seront vidées. Les absences et les listes d'élèves ne changent pas.",
    'تطبيق': "Appliquer",
    'لم نجد في الملف جدول الأقسام (أيام الأسبوع والحصص) مع رموز المواد. تأكدوا أنه ملف «التنظيم التربوي».': "Le fichier ne contient pas de tableau des classes (jours et séances) avec les codes des matières. Vérifiez qu'il s'agit du fichier « organisation pédagogique ».",
    'تعذر تحميل مكتبة قراءة إكسيل، تحقّقوا من الاتصال بالإنترنت ثم أعيدوا المحاولة.': "Impossible de charger la bibliothèque de lecture Excel, vérifiez la connexion Internet puis réessayez.",
    'اختاروا قسما واحدا على الأقل.': "Choisissez au moins une classe.",
    'الصيغة غير صحيحة.': 'Format incorrect.'
  };

  /* ---------- sentence patterns: [regex, template or function] ----------
   * template: $n = group n as it is, %n = group n translated again.  */
  var SENT = [
    [/^تم العثور على (\d+) (?:قسم|أقسام) و(\d+) (?:أستاذ|أساتذة) في الملف\. اختاروا القسم الذي يُطبَّق عليه كل جدول:$/, 'Trouvé dans le fichier : $1 classe(s) et $2 professeur(s). Choisissez la classe à laquelle appliquer chaque emploi du temps :'],
    [/^➕ إنشاء قسم «(.*)»$/, '➕ Créer la classe « $1 »'],
    [/^لا يمكن تطبيق قسمين من الملف على القسم نفسه «(.*)»\.$/, 'Impossible d\'appliquer deux classes du fichier à la même classe « $1 ».'],
    [/^تم تحديث المادة والأستاذ في (\d+) (?:قسم|أقسام) \((\d+) حصة\)(?:، منها (\d+) (?:قسم جديد|أقسام جديدة))?\.$/, function (m) { return 'Matière et professeur mis à jour dans ' + m[1] + ' classe(s) (' + m[2] + ' séances)' + (m[3] ? ', dont ' + m[3] + ' nouvelle(s) classe(s)' : '') + '.'; }],
    [/^رموز بلا أستاذ في الملف: (.*) \(كُتبت كما هي في خانة المادة\)\.$/, 'Codes sans professeur dans le fichier : $1 (écrits tels quels dans la case matière).'],
    [/^في (\d+) حصة تختلف المادة في جدول الأستاذ عن جدول القسم \(مثال: (.*)\)، واعتُمدت مادة الأستاذ\.$/, 'Dans $1 séance(s), la matière du tableau du professeur diffère de celle de la classe (exemple : $2) ; la matière du professeur a été retenue.'],
    [/^الملف يحتوي على (\d+) حصص صباحا و(\d+) مساء بينما الجدول الحالي (\d+) صباحا و(\d+) مساء: تُهمَل الحصص الزائدة \(عدّلوا «عدد الحصص» ثم أعيدوا الاستيراد إن لزم\)\.$/, 'Le fichier contient $1 séances le matin et $2 l\'après-midi alors que le tableau actuel en a $3 et $4 : les séances en trop sont ignorées (modifiez « Nombre de séances » puis réimportez si nécessaire).'],
    [/^الموسم الدراسي (\d{4}\/\d{4})$/, 'Année scolaire $1'],
    [/^الموسم الدراسي (\d{4}\/\d{4}) \(الجاري\)$/, 'Année scolaire $1 (en cours)'],
    [/^الموسم الدراسي (\d{4}\/\d{4}) \(مؤرشف\)$/, 'Année scolaire $1 (archivée)'],
    [/^الموسم الدراسي الجاري: (\d{4}\/\d{4})$/, 'Année scolaire en cours : $1'],
    [/^🗄️ أرشفة الموسم (\d{4}\/\d{4})$/, "🗄️ Archiver l'année $1"],
    [/^أرشفة الموسم تحفظ غياب كل أسابيعه في الأرشيف \(للاطلاع والطباعة من «الإحصائيات ← الموسم»\)، ثم يُمسح الغياب من الجدول وتبدأ الإحصائيات من الصفر في الموسم (\d{4}\/\d{4})\.?$/, "L'archivage de l'année enregistre dans l'archive les absences de toutes ses semaines (à consulter et imprimer depuis « Statistiques → Année »), puis efface les absences du tableau et remet les statistiques à zéro pour l'année $1."],
    [/^تمت أرشفة الموسم (\d{4}\/\d{4}) \((\d+) (أسبوع|أسابيع)\)\. بدأ الموسم (\d{4}\/\d{4}): حدّدوا تواريخ الأسبوع الأول \(من \/ إلى\) في أعلى الصفحة\.$/, "L'année $1 a été archivée ($2 semaine(s)). L'année $4 commence : fixez les dates de la première semaine (Du / Au) en haut de la page."],
    [/^حذف أرشيف الموسم (\d{4}\/\d{4}) نهائيا مع كل إحصائياته؟ لا يمكن التراجع عن ذلك\.$/, "Supprimer définitivement l'archive de l'année $1 avec toutes ses statistiques ? Cette action est irréversible."],
    [/^📦 الموسم الدراسي (\d{4}\/\d{4}) — موسم مؤرشف، للاطلاع والطباعة فقط(?: \(أُرشف بتاريخ (.+)\))?$/, function (m) { return '📦 Année scolaire ' + m[1] + ' — année archivée, consultation et impression uniquement' + (m[2] ? ' (archivée le ' + m[2] + ')' : ''); }],
    [/^الموسم (\d{4}\/\d{4}) مؤرشف من قبل\.$/, "L'année $1 est déjà archivée."],
    [/^القسم (\d+)$/, 'Classe $1'],
    [/^ورقة غياب$/, "Feuille d'absence"],
    [/^ح(\d+)$/, 'S$1'],
    [new RegExp('^(' + DAYRE + ') (' + SHRE + ')$'), '%1 %2'],
    [new RegExp('^(' + DAYRE + ') (' + SHRE + ') ح(\\d+)$'), '%1 %2 S$3'],
    [new RegExp('^(' + DAYRE + ') (\\d{4}-\\d{2}-\\d{2})$'), '%1 $2'],
    [new RegExp('^(' + MON + ') (\\d{4})$'), function (m) { return MONTHS_FR[m[1]] + ' ' + m[2]; }],
    [new RegExp('^(' + MON + ')$'), function (m) { return MONTHS_FR[m[1]]; }],
    [/^ساعة واحدة$/, '1 heure'],
    [/^ساعتان$/, '2 heures'],
    [/^(\d+) ساعات$/, '$1 heures'],
    [/^(\d+) ساعة$/, function (m) { return pl(m[1], 'heure', 'heures'); }],
    [/^(\d+) س$/, '$1 h'],
    [/^الأسبوع الحالي \((.+)\) عطلة بينية ولا يدخل في الإحصائيات\. ستُقدَّم التواريخ 7 أيام للانتقال إلى الأسبوع التالي\.$/, "La semaine en cours ($1) est une période de vacances : elle n'entre pas dans les statistiques. Les dates avanceront de 7 jours pour passer à la semaine suivante."],
    [/^(\d+) مبررة$/, '$1 justifiée(s)'],
    [/^(\d+) غير مبررة$/, '$1 non justifiée(s)'],
    [/^\(منها (\d+) مبررة\)$/, '(dont $1 justifiée(s))'],
    [/^(\d+) حصة غياب$/, function (m) { return pl(m[1], "séance d'absence", "séances d'absence"); }],
    [/^القسم: (.*)$/, function (m, t) { var v = t(m[1]); return /^Classe\b/.test(v) ? v : 'Classe ' + v; }],
    [/^المستوى: (.*)$/, 'Niveau $1'],
    [/^المبيان: (.+) (حسب .+)$/, function (m, t) { var g = t(m[2]); return 'Graphique : ' + t(m[1]) + ' ' + g.charAt(0).toLowerCase() + g.slice(1); }],
    [/^التطور اليومي: (.+)$/, 'Évolution journalière : %1'],
    [/^(.*) — الأكثر غيابا$/, '$1 — le plus absent'],
    [new RegExp('^(?:(.*) )?— (' + HRS + ') غياب هذا الشهر$'), function (m, t) { return (m[1] ? m[1] + ' ' : '') + '— ' + t(m[2]) + " d'absence ce mois-ci"; }],
    [/^طُبع بتاريخ (.+)$/, 'Imprimé le $1'],
    [/^المجموع \((\d+) تلميذ\)$/, function (m) { return 'Total (' + pl(m[1], 'élève', 'élèves') + ')'; }],
    [/^الأسبوع من (\S+) إلى (\S+)$/, 'Semaine du $1 au $2'],
    [/^من (\S+) إلى (\S+?)(?: \(الحالي\))?$/, function (m, t) { return 'Du ' + m[1] + ' au ' + m[2] + (/\(الحالي\)$/.test(m[0]) ? ' (en cours)' : ''); }],
    [/^عدد الأيام المسجّلة في هذا الشهر: (\d+)\.$/, 'Nombre de jours enregistrés ce mois-ci : $1.'],
    [/^تنبيه: لا تتوفر تفاصيل التلاميذ للأسابيع المسجّلة قبل هذا التحديث \((.*)\)\.$/, function (m) { return 'Attention : le détail par élève n\'est pas disponible pour les semaines enregistrées avant cette mise à jour (' + m[1].replace(/،/g, ',') + ').'; }],
    [/^لا يوجد تلاميذ غائبون في هذه الفترة(?: \((.*)\))?\.$/, function (m, t) { return 'Aucun élève absent durant cette période' + (m[1] ? ' (' + t(m[1]) + ')' : '') + '.'; }],
    [/^حذف الأسبوع (\S+) من سجل الإحصائيات نهائيا؟$/, 'Supprimer définitivement la semaine $1 de l\'historique des statistiques ?'],

    // WhatsApp panel
    [/^أدخلوا أولا رقم هاتف ولي الأمر في جدول القسم (.+) أمام اسم التلميذ\(ة\)\.$/, "Saisissez d'abord le numéro de téléphone du parent dans le tableau de la &1, en face du nom de l'élève."],
    [/^أدخلوا رقم هاتف ولي الأمر في جدول القسم (.+) أمام اسم التلميذ\(ة\)، ثم أرسلوا من لوحة «إشعارات تلقائية»\.$/, "Saisissez le numéro de téléphone du parent dans le tableau de la &1, en face du nom de l'élève, puis envoyez depuis le panneau « Avis automatiques »."],
    [new RegExp('^بلغ غياب التلميذ\\(ة\\) (.+) \\(القسم (.+)\\) (' + HRS + ') هذا الشهر: يلزم إرسال استدعاء لولي الأمر للحضور\\. هل ترسلونه الآن؟$'), "Les absences de l'élève $1 atteignent %3 ce mois-ci (&2) : une convocation du parent est nécessaire. L'envoyer maintenant ?"],
    [/^سُجّل غياب التلميذ\(ة\) (.+) \(القسم (.+)\)\. إشعار ولي الأمر جاهز، هل ترسلونه الآن؟$/, "L'absence de l'élève $1 (&2) a été enregistrée. L'avis au parent est prêt : l'envoyer maintenant ?"],

    // classes / students
    [/^حذف القسم "(.+)" نهائيا مع كل بياناته \(اللائحة والغياب والهواتف\)؟$/, 'Supprimer définitivement la classe « $1 » avec toutes ses données (liste, absences et téléphones) ?'],
    [/^اليوم عطلة نهاية الأسبوع \((السبت|الأحد)\)، ولا توجد حصص لتسجيل غيابها\.$/, function (m) { return "Aujourd'hui c'est le week-end (" + (m[1] === 'السبت' ? 'samedi' : 'dimanche') + ") : il n'y a pas de séances dont noter l'absence."; }],
    [/^الورقة تعرض الأسبوع من (\S+) إلى (\S+) وهو ليس أسبوع اليوم \((\S+)\)\. على المسؤول أن يبدأ الأسبوع الجديد \(زر «التالي»\) ليتمكن الأساتذة من تسجيل الغياب\.$/, "La feuille affiche la semaine du $1 au $2, qui n'est pas celle d'aujourd'hui ($3). L'administrateur doit démarrer la nouvelle semaine (bouton « Suivant ») pour que les professeurs puissent noter les absences."],
    [/^يمكن تسجيل غياب حصص اليوم فقط: اليوم (\S+) وهذه الخانة من يوم (\S+)\.$/, function (m, t) { return "Seules les absences des séances d'aujourd'hui peuvent être notées : aujourd'hui c'est " + t(m[1]).toLowerCase() + " et cette case est celle de " + t(m[2]).toLowerCase() + "."; }],
    [/^هذه الحصة لم يحن وقتها بعد \(تبدأ على الساعة (\d{2}:\d{2})\)\.$/, "Cette séance n'a pas encore commencé (début à $1)."],
    [/^هذه الحصة ليست من حصصكم: اسم الأستاذ\(ة\) المكتوب فيها «(.*)» واسم حسابكم «(.*)»\.$/, "Cette séance n'est pas l'une des vôtres : le nom du/de la professeur(e) inscrit est « $1 » et le nom de votre compte est « $2 »."],
    [/^سيُمسح غياب كل تلاميذ القسم \((\d+) غيابا\) وأرقام هواتفهم \((\d+)\) ويبدأ الجدول فارغا\.$/, function (m) { return "Les absences de tous les élèves de la classe (" + m[1] + ") et leurs numéros de téléphone (" + m[2] + ") seront effacés ; le tableau repartira vide."; }],
    [/^سيُحتفظ بغياب وهواتف (\d+) تلميذا، وسيُضاف (\d+) تلميذا جديدا\.$/, function (m) { return "Les absences et téléphones de " + pl(m[1], 'élève', 'élèves') + " seront conservés, et " + pl(m[2], 'nouvel élève', 'nouveaux élèves') + " seront ajoutés."; }],
    [/^أسماء متشابهة اعتُبرت نفس التلميذ: (.+)$/, function (m) { return 'Noms très proches considérés comme le même élève : ' + m[1].replace(/ ← /g, ' → ').replace(/؛ /g, ' ; '); }],
    [/^موجودون في اللائحة الحالية وغير موجودين في الملف \((\d+)\): (.+)$/, function (m) { return "Présents dans la liste actuelle mais absents du fichier (" + m[1] + ") : " + m[2].replace(/، /g, ', '); }],
    [/^تم تحديث اللائحة: احتُفظ بغياب وهواتف (\d+) تلميذا(?:، وأُضيف (\d+) تلميذا جديدا)?(?:، وحُذف (\d+) غير موجود في الملف)?\.$/, function (m) { return 'Liste mise à jour : absences et téléphones conservés pour ' + pl(m[1], 'élève', 'élèves') + (m[2] ? ', ' + pl(m[2], 'nouvel élève ajouté', 'nouveaux élèves ajoutés') : '') + (m[3] ? ', ' + m[3] + " supprimé(s) car absent(s) du fichier" : '') + '.'; }],
    [/^أُضيف (\d+) تلميذا(?:، وتُجوهل (\d+) موجودا من قبل)?\.$/, function (m) { return pl(m[1], 'élève ajouté', 'élèves ajoutés') + (m[2] ? ', ' + m[2] + ' déjà présent(s) ignoré(s)' : '') + '.'; }],
    [/^الورقة الآن: (\d+) تلميذا، (\d+) غيابا، (\d+) هاتفا\.$/, "Feuille actuelle : $1 élèves, $2 absences, $3 téléphones."],
    [/^(\d+) تلميذا، (\d+) غيابا، (\d+) هاتفا(?: — أسبوع (\S+))?$/, function (m) { return m[1] + ' élèves, ' + m[2] + ' absences, ' + m[3] + ' téléphones' + (m[4] ? ' — semaine du ' + m[4] : ''); }],
    [/^(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}) — (قبل حفظ أضاع بيانات|نسخة يدوية|نسخة دورية)$/, function (m) { return m[1] + ' — ' + ({ 'قبل حفظ أضاع بيانات': 'avant une sauvegarde qui a fait perdre des données', 'نسخة يدوية': 'copie manuelle', 'نسخة دورية': 'copie périodique' })[m[2]]; }],
    [/^تمّ استرجاع (\d+) غيابا و(\d+) هاتفا لتلاميذ اللائحة الحالية\.$/, "$1 absences et $2 téléphones ont été rendus aux élèves de la liste actuelle."],
    [/^سيُعاد الجدول كله كما كان في هذه النسخة \((\d+) تلميذا، (\d+) غيابا\)، وتضيع التعديلات التي أُجريت بعدها\. تُحفظ نسخة من الحالة الحالية قبل ذلك\. المتابعة؟$/, "Tout le tableau sera remis comme dans cette copie ($1 élèves, $2 absences) ; les modifications faites depuis seront perdues. Une copie de l'état actuel est faite avant. Continuer ?"],
    [/^سيستعيد تلاميذ اللائحة الحالية غيابهم \(إن كان الأسبوع نفسه\) وهواتفهم من هذه النسخة \((\d+) غيابا، (\d+) هاتفا\)، دون المساس بغير ذلك\. المتابعة؟$/, "Les élèves de la liste actuelle retrouveront leurs absences (si c'est la même semaine) et leurs téléphones de cette copie ($1 absences, $2 téléphones), sans toucher au reste. Continuer ?"],
    [/^لا توجد بيانات محفوظة للأسبوع الذي يبدأ في (\S+)\.$/, "Aucune donnée enregistrée pour la semaine commençant le $1."],
    [/^الأسبوع الحالي \((\S+)\) يُحفظ كما هو ويمكنكم الرجوع إليه\.$/, "La semaine actuelle ($1) est conservée telle quelle et vous pourrez y revenir."],
    [/^حذف (\d+) تلميذ\(ة\) من لائحة القسم؟$/, function (m) { return 'Supprimer ' + pl(m[1], 'élève', 'élèves') + ' de la liste de la classe ?'; }],
    [/^حذف "(.+)" من لائحة القسم؟$/, 'Supprimer « $1 » de la liste de la classe ?'],
    [/^(تسجيل|حذف) غياب التلميذ\(ة\) (.+) — القسم (.+) — (.+?) — ح(\d+)(?: \((.*)\))?؟$/, function (m, t) {
      return (m[1] === 'تسجيل' ? "Enregistrer l'absence de l'élève " : "Supprimer l'absence de l'élève ") + m[2] + ' — ' + clsLabel(m[3]) + ' — ' + t(m[4]) + ' — S' + m[5] + (m[6] ? ' (' + m[6] + ')' : '') + ' ?';
    }],
    [/^غياب التلميذ\(ة\) (.+) — القسم (.+) — (.+?) — ح(\d+)(?: \((.*)\))? \((مبرر|غير مبرر)\)\.$/, function (m, t) {
      return "Absence de l'élève " + m[1] + ' — ' + clsLabel(m[2]) + ' — ' + t(m[3]) + ' — S' + m[4] + (m[5] ? ' (' + m[5] + ')' : '') + ' : ' + (m[6] === 'مبرر' ? 'justifiée' : 'non justifiée') + '.';
    }],
    [new RegExp('^لا يمكن تسجيل غياب في حصة لم يحن وقتها بعد: (.+) — (\\S+) على الساعة (\\d{2}:\\d{2})\\.$'), "Impossible d'enregistrer l'absence d'une séance qui n'a pas encore commencé : %1 — $2 à $3."],

    // import
    [/^العمود (\S+)، بدءًا من الصف (\d+) — تم العثور على (\d+) اسم$/, function (m) { return 'Colonne ' + m[1] + ', à partir de la ligne ' + m[2] + ' — ' + pl(m[3], 'nom trouvé', 'noms trouvés'); }],

    // periods
    [/^توقيت حصص القسم «(.*)» وحده — بداية كل حصة \(الساعة:الدقيقة\): (\d+) حصص صباحا \| (\d+) حصص مساء، تفصل بينها العلامة \| \. مثال: (.*)$/, "Horaires des séances de la classe « $1 » uniquement — heure de début de chaque séance (heures:minutes) : $2 séances le matin | $3 séances l'après-midi, séparées par le signe | . Exemple : $4"],
    [/^بداية كل حصة \(الساعة:الدقيقة\): (\d+) حصص صباحا \| (\d+) حصص مساء، تفصل بينها العلامة \| \. مثال: (.*)$/, "Heure de début de chaque séance (heures:minutes) : $1 séances le matin | $2 séances l'après-midi, séparées par le signe | . Exemple : $3"],
    [/^الصيغة غير صحيحة\. عدد الحصص الحالي: (\d+) صباحا و(\d+) مساء\. اكتبوا الساعات هكذا: (.*)$/, "Format incorrect. Nombre de séances actuel : $1 le matin et $2 l'après-midi. Écrivez les heures ainsi : $3"],
    [/^➕ إضافة حصة (صباحا|مساء)$/, '➕ Ajouter une séance (%1)'],
    [/^➖ حذف حصة (صباحا|مساء)$/, '➖ Supprimer une séance (%1)'],
    [/^عدد الحصص في كل يوم: (\d+) صباحا و(\d+) مساء \(من (\d+) كحد أقصى لكل فترة\)\. تنطبق التغييرات على كل الأقسام وكل أيام الأسبوع\.$/, "Nombre de séances par jour : $1 le matin et $2 l'après-midi (maximum $3 par demi-journée). Les changements s'appliquent à toutes les classes et à tous les jours de la semaine."],
    [/^تمت إضافة الحصة ح(\d+) (صباحا|مساء)\. يمكنكم ضبط توقيتها من «توقيت الحصص»\.$/, "La séance S$1 (%2) a été ajoutée. Vous pouvez régler son horaire depuis « Horaires des séances »."],
    [/^تم حذف الحصة ح(\d+) (صباحا|مساء)\.$/, 'La séance S$1 (%2) a été supprimée.'],
    [/^رقم الحصة التي تريدون حذفها (صباحا|مساء) \(من 1 إلى (\d+)\)$/, 'Numéro de la séance à supprimer (%1), de 1 à $2'],
    [/^رقم غير صحيح\. اكتبوا رقما بين 1 و(\d+)\.$/, 'Numéro incorrect. Saisissez un nombre entre 1 et $1.'],
    [/^ستُحذف الحصة ح(\d+) (صباحا|مساء) من كل أيام الأسبوع ومن كل الأقسام، مع المادة والأستاذ المسجلين فيها(?: و(\d+) ساعة غياب مسجلة فيها هذا الأسبوع)?، وتتغيّر أرقام الحصص التي بعدها\. الأسابيع المؤرشفة في الإحصائيات لا تتغيّر\.$/, function (m) {
      return 'La séance S' + m[1] + ' (' + EXACT[m[2]] + ') sera supprimée de tous les jours de la semaine et de toutes les classes, avec la matière et le professeur qui y sont enregistrés' + (m[3] ? ' et ' + pl(m[3], "heure d'absence enregistrée", "heures d'absence enregistrées") + ' cette semaine' : '') + ". Les numéros des séances suivantes changeront. Les semaines archivées dans les statistiques ne changent pas.";
    }],

    // new week / previous week
    [/^سيُحفظ غياب الأسبوع الحالي \((.*)\) في سجل الإحصائيات، ثم يُمسح الغياب من الجدول وتُقدَّم التواريخ 7 أيام\. أسماء التلاميذ والمواد والأساتذة تبقى كما هي\.$/, "Les absences de la semaine en cours ($1) seront enregistrées dans l'historique des statistiques, puis effacées du tableau, et les dates avancées de 7 jours. Les noms des élèves, les matières et les professeurs restent inchangés."],
    [/^⏪ تعرضون الآن الأسبوع الماضي \(من (\S+?)(?: إلى (\S+))?\)\. أي تصحيح هنا يُحدِّث سجل الإحصائيات؛ ثم اضغطوا «الأسبوع الجاري»\.$/, function (m) {
      return '⏪ Vous affichez la semaine précédente (' + (m[2] ? 'du ' + m[1] + ' au ' + m[2] : 'à partir du ' + m[1]) + "). Toute correction faite ici met à jour l'historique des statistiques ; cliquez ensuite sur « Semaine en cours ».";
    }],
    [/^سيُحفظ ما عدّلتموه في الأسبوع الماضي، ثم يُعرض الأسبوع الحالي \((.*)\) كما تركتموه\.$/, "Vos modifications de la semaine précédente seront enregistrées, puis la semaine en cours ($1) s'affichera telle que vous l'avez laissée."],
    [/^سيُعرض الأسبوع الماضي \((.*)\) لتصحيح أي ساعة غياب سُجّلت بالخطأ\. الأسبوع الحالي يُحفظ كما هو ويمكنكم الرجوع إليه بنقرة\.$/, "La semaine précédente ($1) sera affichée pour corriger toute heure d'absence enregistrée par erreur. La semaine en cours est conservée telle quelle et vous pourrez y revenir d'un clic."],
    [/^سيُعرض الأسبوع الماضي \((.*)\) من سجل الإحصائيات: يظهر فيه التلاميذ الذين سُجّل غيابهم \(أسماء المواد والأساتذة تبقى كما هي في الجدول\)\. صحّحوا ما يلزم ثم عودوا إلى الأسبوع الحالي\.$/, "La semaine précédente ($1) sera affichée à partir de l'historique des statistiques : on y voit les élèves dont l'absence a été enregistrée (les matières et les professeurs restent ceux du tableau). Corrigez ce qui est nécessaire, puis revenez à la semaine en cours."],

    // roll call «لا أحد» + teacher without internet
    [/^🟠 دون اتصال — يمكنكم متابعة تسجيل الغياب و«لا أحد»، وسيُرسَل ما تسجّلونه تلقائيا عند عودة الإنترنت(?: \((\d+) في الانتظار\))?$/, function (m) {
      return '🟠 Hors connexion — vous pouvez continuer à noter les absences et « Aucun absent » ; ce que vous saisissez sera envoyé automatiquement au retour d\'Internet' + (m[1] ? ' (' + m[1] + ' en attente)' : '');
    }],
    [/^تأكيد «لا أحد» — القسم (.+) — (.+?) — ح(\d+)(?: \((.*)\))?؟$/, function (m, t) {
      return 'Confirmer « Aucun absent » — ' + clsLabel(m[1]) + ' — ' + t(m[2]) + ' — S' + m[3] + (m[4] ? ' (' + m[4] + ')' : '') + ' ?';
    }],
    [/^🟡 جارٍ إرسال (\d+) تسجيل إلى الخادم…$/, '🟡 Envoi de $1 saisie(s) au serveur…'],
    [/^توجد (\d+) تسجيلات لم تُرسَل إلى الخادم بعد \(عمل دون اتصال\)\. الخروج الآن يحذفها نهائيا من هذا الجهاز\. هل تريدون الخروج؟$/, "$1 saisie(s) n'ont pas encore été envoyées au serveur (travail hors connexion). Se déconnecter maintenant les supprime définitivement de cet appareil. Voulez-vous vous déconnecter ?"],
    [/^انتهت الجلسة، سجّلوا الدخول من جديد\. تسجيلاتكم غير المرسلة محفوظة على هذا الجهاز وستُرسَل بعد الدخول بالحساب نفسه\.$/, "La session a expiré, reconnectez-vous. Vos saisies non envoyées sont conservées sur cet appareil et seront envoyées après la connexion avec le même compte."],
    [/^إلغاء التصريح «لا أحد» لهذه الحصة \(القسم (.+)\)؟$/, "Annuler la déclaration « Aucun absent » pour cette séance (&1) ?"],
    [/^تعذّر قبول (\d+ تسجيلات|تسجيل) من التسجيلات المؤجلة:$/, function (m) { var n = parseInt(m[1], 10); return n > 1 ? n + " saisies différées n'ont pas été acceptées :" : "Une saisie différée n'a pas été acceptée :"; }],
    [/^• «لا أحد» — القسم (.+) — (\S+ \S+) ح(\d+): (.+)$/, function (m, t) { return '• « Aucun absent » — ' + clsLabel(m[1]) + ' — ' + t(m[2]) + ' S' + m[3] + ' : ' + t(m[4]); }],
    [/^• (.+) — القسم (.+) — (\S+ \S+) ح(\d+): (.+)$/, function (m, t) { return '• ' + m[1] + ' — ' + clsLabel(m[2]) + ' — ' + t(m[3]) + ' S' + m[4] + ' : ' + t(m[5]); }],
    [/^لا أحد — (.*)$/, 'Aucun absent — $1'],
    [/^الحصة تُعدّ «مُنادى فيها» إذا سُجّل فيها غياب أو ضغط الأستاذ\(ة\) زر «لا أحد»\. تُعلَّم الحصة «بلا نداء» بعد (\d+) دقيقة من بدايتها\. الأسبوع الجاري فقط\.$/, "Une séance est « appelée » si une absence y est enregistrée ou si le professeur a appuyé sur « Aucun ». Elle est marquée « sans appel » $1 minutes après son début. Semaine en cours uniquement."],

    // users
    [/^ستُزال إمكانية دخول هذا الحساب \((.+)\) فورا\. المتابعة؟$/, "L'accès de ce compte ($1) sera retiré immédiatement. Continuer ?"]
  ];
  var MONTHS_FR = { 'يناير': 'janvier', 'فبراير': 'février', 'مارس': 'mars', 'أبريل': 'avril', 'ماي': 'mai', 'يونيو': 'juin', 'يوليوز': 'juillet', 'غشت': 'août', 'شتنبر': 'septembre', 'أكتوبر': 'octobre', 'نونبر': 'novembre', 'دجنبر': 'décembre' };

  /* ---------- the translator ---------- */
  var cache = Object.create(null);

  function typo(s) {
    return s.replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ').replace(/،/g, ',');
  }

  // class name for a sentence: "classe 1AIPC-2" / "classe 1" (the default Arabic name becomes Classe 1)
  function clsLabel(g) {
    var t = tr(g);
    return /^Classe\b/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : 'classe ' + g;
  }
  function fill(tpl, m) {
    return tpl.replace(/([$%&])(\d)/g, function (_, k, i) {
      var g = m[+i] == null ? '' : m[+i];
      return k === '%' ? tr(g) : (k === '&' ? clsLabel(g) : g);
    });
  }

  // translate one line (no line breaks); returns null if nothing matched
  function trLine(core) {
    var hit = EXACT[core];
    if (hit !== undefined) return hit;
    var i, p, m;
    for (i = 0; i < SENT.length; i++) {
      p = SENT[i];
      m = core.match(p[0]);
      if (m) return typeof p[1] === 'function' ? p[1](m, tr) : fill(p[1], m);
    }
    // "title (3)" -> translated title + count
    m = core.match(/^(.+) \((\d+)\)$/);
    if (m) { var a = trLine(m[1]); if (a !== null) return a + ' (' + m[2] + ')'; }
    // "a — b": translate every part
    var seps = [' — ', ' - '];
    for (var si = 0; si < seps.length; si++) {
      if (core.indexOf(seps[si]) > 0) {
        var parts = core.split(seps[si]), ch = false;
        parts = parts.map(function (x) { var r = trLine(x); if (r !== null) { ch = true; return r; } return x; });
        if (ch) return parts.join(seps[si]);
      }
    }
    // several sentences: translate each one
    if (/\.\s+\S/.test(core)) {
      var sents = core.replace(/\.(\s+)(?=\S)/g, '.\u0001').split('\u0001'), ch2 = false;
      if (sents.length > 1) {
        sents = sents.map(function (x) { var r = trLine(x); if (r !== null) { ch2 = true; return r; } return x; });
        if (ch2) return sents.join(' ');
      }
    }
    return null;
  }

  function tr(s) {
    if (typeof s !== 'string' || !AR.test(s)) return s;
    var c = cache[s];
    if (c !== undefined) return c;
    var lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = s.slice(lead.length, s.length - trail.length);
    var out;
    if (core.indexOf('\n') >= 0) {
      out = core.split('\n').map(function (ln) {
        if (!AR.test(ln)) return ln;
        var l2 = ln.match(/^\s*/)[0], t2 = ln.match(/\s*$/)[0], k = ln.trim();
        var r = trLine(k);
        return r === null ? ln : l2 + typo(r) + t2;
      }).join('\n');
    } else {
      var r = trLine(core);
      out = r === null ? core : typo(r);
    }
    out = lead + out + trail;
    if (Object.keys(cache).length < 4000) cache[s] = out;
    return out;
  }

  // text inside an HTML / SVG string: only the text between tags and a few attributes
  function Th(h) {
    if (typeof h !== 'string' || !AR.test(h)) return h;
    h = h.replace(/>([^<>]+)</g, function (m, t) { return AR.test(t) ? '>' + tr(t) + '<' : m; });
    h = h.replace(/\b(title|alt|placeholder)="([^"]*)"/g, function (m, a, v) { return AR.test(v) ? a + '="' + tr(v) + '"' : m; });
    return h;
  }

  /* ---------- page: left-to-right + language switch ---------- */
  var de = w.document.documentElement;
  de.lang = 'fr';
  de.dir = 'ltr';
  var css = w.document.createElement('style');
  css.id = 'frcss';
  css.textContent =
    'html[dir=ltr] td.name{text-align:left;right:auto;left:0}' +
    'html[dir=ltr] .import-box{text-align:left}' +
    'html[dir=ltr] table.sv td.svn{text-align:left}' +
    'html[dir=ltr] #usersBody span[dir=ltr]{text-align:left!important}' +
    'html[dir=ltr] .modal-box p,html[dir=ltr] #weekBanner,html[dir=ltr] #viewBanner{text-align:left}';
  (w.document.head || de).appendChild(css);

  var ATTRS = ['placeholder', 'title', 'alt', 'aria-label'];
  function fixAttr(el, a) {
    var v = el.getAttribute(a);
    if (v && AR.test(v)) { var o = tr(v); if (o !== v) el.setAttribute(a, o); }
  }
  function fixText(t) {
    var v = t.nodeValue;
    if (!v || !AR.test(v)) return;
    var p = t.parentNode;
    // a <select> option without value= uses its text as value: keep the original value
    if (p && p.nodeName === 'OPTION' && !p.hasAttribute('value')) p.setAttribute('value', v);
    var o = tr(v);
    if (o !== v) t.nodeValue = o;
  }
  function walk(n) {
    if (n.nodeType === 3) { fixText(n); return; }
    if (n.nodeType !== 1) return;
    var tag = n.nodeName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return;
    for (var i = 0; i < ATTRS.length; i++) if (n.hasAttribute(ATTRS[i])) fixAttr(n, ATTRS[i]);
    var c = n.firstChild;
    while (c) { var nx = c.nextSibling; walk(c); c = nx; }
  }

  function start() {
    w.document.title = tr(w.document.title);
    walk(w.document.documentElement);
    new w.MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i];
        if (r.type === 'childList') { for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]); }
        else if (r.type === 'characterData') fixText(r.target);
        else if (r.type === 'attributes') fixAttr(r.target, r.attributeName);
      }
    }).observe(w.document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    de.style.visibility = '';
  }
  de.style.visibility = 'hidden';
  if (w.document.readyState === 'loading') w.document.addEventListener('DOMContentLoaded', start); else start();
  w.setTimeout(function () { de.style.visibility = ''; }, 2500);

  w.LANG = 'fr';
  w.T = tr;
  w.Th = Th;
  w.setLang = setLang;
  w.FR = { tr: tr, Th: Th, EXACT: EXACT, SENT: SENT };
})(window);
