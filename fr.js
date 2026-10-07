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

    // toolbar
    '🖼️ شعار المؤسسة': "🖼️ Logo de l'établissement",
    'تغيير شعار المؤسسة الظاهر في أعلى الصفحة وفي الطباعة': "Changer le logo affiché en haut de la page et à l'impression",
    '🧮 عدد الحصص': '🧮 Nombre de séances',
    'إضافة حصة أو حذفها صباحا أو مساء لتلائم النظام الدراسي للمؤسسة': "Ajouter ou supprimer une séance le matin ou l'après-midi selon l'organisation de l'établissement",
    '⏰ توقيت الحصص': '⏰ Horaires des séances',
    'بداية كل حصة، لمنع تسجيل غياب حصة لم يحن وقتها': "Heure de début de chaque séance, pour empêcher d'enregistrer l'absence d'une séance qui n'a pas encore commencé",
    '⏪ الأسبوع الماضي': '⏪ Semaine précédente',
    'عرض الأسبوع الماضي لتصحيح غياب سُجّل بالخطأ': 'Afficher la semaine précédente pour corriger une absence enregistrée par erreur',
    '⏩ العودة إلى الأسبوع الحالي': '⏩ Retour à la semaine en cours',
    '🗓️ أسبوع جديد': '🗓️ Nouvelle semaine',
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
    'من يسجّل حسابا جديدا من صفحة الدخول لا يستطيع الدخول حتى توافقوا على طلبه هنا. الحسابات المقبولة تطلع على الجدول والإحصائيات فقط دون تعديل.': "Toute personne qui crée un compte depuis la page de connexion ne peut pas se connecter tant que vous n'avez pas approuvé sa demande ici. Les comptes approuvés peuvent seulement consulter le tableau et les statistiques, sans rien modifier.",
    'إغلاق': 'Fermer',
    'تعذر تحميل القائمة، تحقّقوا من الاتصال وأعيدوا المحاولة.': 'Impossible de charger la liste : vérifiez la connexion et réessayez.',
    'طلبات بانتظار موافقتكم': 'Demandes en attente de votre approbation',
    '✔ قبول': '✔ Accepter',
    '✖ رفض': '✖ Refuser',
    'لا توجد طلبات معلّقة.': 'Aucune demande en attente.',
    'حسابات الاطلاع المقبولة': 'Comptes de consultation approuvés',
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
    'أنتم تعرضون الأسبوع الماضي. عودوا أولا إلى الأسبوع الحالي قبل بدء أسبوع جديد.': "Vous affichez la semaine précédente. Revenez d'abord à la semaine en cours avant de commencer une nouvelle semaine.",
    'حدّدوا أولا تواريخ الأسبوع الحالي (من / إلى) في أعلى الصفحة، حتى يُحفظ غيابه في سجل الإحصائيات.': "Définissez d'abord les dates de la semaine en cours (Du / Au) en haut de la page, afin que ses absences soient enregistrées dans l'historique des statistiques.",
    'حدّدوا أولا تواريخ الأسبوع الحالي (من / إلى).': "Définissez d'abord les dates de la semaine en cours (Du / Au).",
    'لا يوجد أسبوع سابق في سجل الإحصائيات.': "Il n'y a pas de semaine précédente dans l'historique des statistiques.",
    'الأسبوع السابق مؤرشف قبل إضافة التفاصيل، فلا يمكن إعادة عرضه للتعديل. ابتداءً من الأسبوع القادم سيتوفر الرجوع كاملا.': "La semaine précédente a été archivée avant l'ajout des détails : elle ne peut pas être réaffichée pour correction. À partir de la semaine prochaine, le retour sera complet.",
    'تغيّرت القائمة قبل التأكيد، أعيدوا المحاولة.': 'La liste a changé avant la confirmation, veuillez réessayer.',
    'تأكيد تسجيل الغياب': "Confirmer l'enregistrement de l'absence",
    'تأكيد حذف الغياب': "Confirmer la suppression de l'absence",
    'الصيغة غير صحيحة.': 'Format incorrect.'
  };

  /* ---------- sentence patterns: [regex, template or function] ----------
   * template: $n = group n as it is, %n = group n translated again.  */
  var SENT = [
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
    [/^حذف (\d+) تلميذ\(ة\) من لائحة القسم؟$/, function (m) { return 'Supprimer ' + pl(m[1], 'élève', 'élèves') + ' de la liste de la classe ?'; }],
    [/^حذف "(.+)" من لائحة القسم؟$/, 'Supprimer « $1 » de la liste de la classe ?'],
    [/^(تسجيل|حذف) غياب التلميذ\(ة\) (.+) — القسم (.+) — (.+?) — ح(\d+)(?: \((.*)\))?؟$/, function (m, t) {
      return (m[1] === 'تسجيل' ? "Enregistrer l'absence de l'élève " : "Supprimer l'absence de l'élève ") + m[2] + ' — ' + clsLabel(m[3]) + ' — ' + t(m[4]) + ' — S' + m[5] + (m[6] ? ' (' + m[6] + ')' : '') + ' ?';
    }],
    [new RegExp('^لا يمكن تسجيل غياب في حصة لم يحن وقتها بعد: (.+) — (\\S+) على الساعة (\\d{2}:\\d{2})\\.$'), "Impossible d'enregistrer l'absence d'une séance qui n'a pas encore commencé : %1 — $2 à $3."],

    // import
    [/^العمود (\S+)، بدءًا من الصف (\d+) — تم العثور على (\d+) اسم$/, function (m) { return 'Colonne ' + m[1] + ', à partir de la ligne ' + m[2] + ' — ' + pl(m[3], 'nom trouvé', 'noms trouvés'); }],

    // periods
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
    [/^⏪ تعرضون الآن الأسبوع الماضي \(من (\S+?)(?: إلى (\S+))?\)\. أي تصحيح هنا يُحدِّث سجل الإحصائيات؛ ثم اضغطوا «العودة إلى الأسبوع الحالي»\.$/, function (m) {
      return '⏪ Vous affichez la semaine précédente (' + (m[2] ? 'du ' + m[1] + ' au ' + m[2] : 'à partir du ' + m[1]) + "). Toute correction faite ici met à jour l'historique des statistiques ; cliquez ensuite sur « Retour à la semaine en cours ».";
    }],
    [/^سيُحفظ ما عدّلتموه في الأسبوع الماضي، ثم يُعرض الأسبوع الحالي \((.*)\) كما تركتموه\.$/, "Vos modifications de la semaine précédente seront enregistrées, puis la semaine en cours ($1) s'affichera telle que vous l'avez laissée."],
    [/^سيُعرض الأسبوع الماضي \((.*)\) لتصحيح أي ساعة غياب سُجّلت بالخطأ\. الأسبوع الحالي يُحفظ كما هو ويمكنكم الرجوع إليه بنقرة\.$/, "La semaine précédente ($1) sera affichée pour corriger toute heure d'absence enregistrée par erreur. La semaine en cours est conservée telle quelle et vous pourrez y revenir d'un clic."],
    [/^سيُعرض الأسبوع الماضي \((.*)\) من سجل الإحصائيات: يظهر فيه التلاميذ الذين سُجّل غيابهم \(أسماء المواد والأساتذة تبقى كما هي في الجدول\)\. صحّحوا ما يلزم ثم عودوا إلى الأسبوع الحالي\.$/, "La semaine précédente ($1) sera affichée à partir de l'historique des statistiques : on y voit les élèves dont l'absence a été enregistrée (les matières et les professeurs restent ceux du tableau). Corrigez ce qui est nécessaire, puis revenez à la semaine en cours."],

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
