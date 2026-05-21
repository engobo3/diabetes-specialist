/**
 * Multilingual fallback responses for the AI chat endpoint.
 * Used when the Gemini API is unavailable so the user still gets a useful reply.
 */

module.exports = {
    fr: {
        emergency: "Attention : Pour tout symptome grave (douleur thoracique, difficulte a respirer, blessure au pied, troubles de la vision), consultez immediatement un medecin ou allez aux urgences.",
        nutrition: "Privilegiez les aliments a index glycemique bas (legumes, cereales completes, legumineuses). Associez toujours des proteines et des fibres a vos glucides pour eviter les pics de glycemie.",
        exercise: "Bouger 30 minutes par jour aide enormement a reguler la glycemie. La marche rapide est ideale. Verifiez votre taux avant et apres l'effort.",
        glucose_tracking: "La regularite est la cle. Notez vos valeurs a jeun et 2h apres les repas. Une glycemie normale a jeun se situe entre 70 et 100 mg/dL.",
        mental_health: "Le diabete peut etre stressant. Le stress influence directement votre glycemie. Prenez du temps pour vous detendre et dormez suffisamment.",
        medication: "Respectez scrupuleusement votre ordonnance. En cas d'oubli ou d'effets secondaires, contactez votre medecin. Verifiez la date de peremption de votre insuline.",
        general: "Bonjour ! Je suis GlucoBot. Je peux vous aider avec des conseils sur l'alimentation, le sport, la gestion de la glycemie ou votre bien-etre.",
        unknown: "Je ne suis pas sur de comprendre. Je peux parler de : nutrition, sport, glycemie, stress, medicaments. Essayez de reformuler.",
        error: "Desole, je suis en maintenance. N'oubliez pas de bien vous hydrater !"
    },
    ln: {
        emergency: "Keba : Mpo na maladi ya makasi (mpasi ya ntolo, mpasi ya kopema, mpota na lokolo, mitungisi ya miso), kende na monganga to na urgence nokinoki.",
        nutrition: "Lia bilei oyo ezali na index glycemique ya nse (ndunda, mbuma ya cereale, madesu). Sangisa ntango nyonso ba proteines na ba fibres na ba glucides na yo.",
        exercise: "Kosala sport miniti 30 mokolo na mokolo esalisaka mingi mpo na glycemie. Kotambola nokinoki ezali malamu. Tala taux na yo liboso mpe nsima ya sport.",
        glucose_tracking: "Kosala yango mbala na mbala ezali fungola. Koma ba valeurs na yo na ntongo mpe nsima ya bilie. Glycemie ya malamu na ntongo ezali 70-100 mg/dL.",
        mental_health: "Diabete ekoki kopesa stress. Stress ezali kobongola glycemie na yo. Kamata ntango ya kopema mpe lala malamu.",
        medication: "Landa ordonnance na yo malamu. Soki obosani to ozali na ba effets secondaires, benga monganga na yo. Tala date ya insuline na yo.",
        general: "Mbote ! Nazali GlucoBot. Nakoki kosalisa yo na toli ya bilie, sport, glycemie to bien-etre na yo.",
        unknown: "Nayebi te ndenge ya kolimbola. Nakoki kosolola na yo mpo na: bilie, sport, glycemie, stress, ba nkisi. Meka koloba na maloba mosusu.",
        error: "Bolimbisi, nazali na bobongisi. Kobosana te komela mai !"
    },
    sw: {
        emergency: "Tahadhari: Kwa dalili kali (maumivu ya kifua, ugumu wa kupumua, jeraha la mguu, matatizo ya macho), tafadhali tembelea daktari au nenda hospitali haraka.",
        nutrition: "Kula vyakula vyenye fahirisi ya glycemiki ya chini (mboga, nafaka nzima, kunde). Changanya protini na nyuzi na wanga wako kuzuia kupanda kwa sukari.",
        exercise: "Kufanya mazoezi dakika 30 kwa siku kunasaidia sana kudhibiti sukari. Kutembea haraka ni bora. Angalia kiwango chako kabla na baada ya mazoezi.",
        glucose_tracking: "Uthabiti ni muhimu. Andika viwango vyako asubuhi na masaa 2 baada ya kula. Sukari ya kawaida asubuhi ni 70-100 mg/dL.",
        mental_health: "Kisukari inaweza kusababisha msongo. Msongo huathiri moja kwa moja sukari yako. Pumzika na ulale vizuri.",
        medication: "Fuata dawa yako kwa uangalifu. Ikiwa umesahau au una madhara, wasiliana na daktari wako. Angalia tarehe ya muda wa insulini.",
        general: "Habari! Mimi ni GlucoBot. Ninaweza kukusaidia na ushauri kuhusu lishe, mazoezi, sukari, au ustawi wako.",
        unknown: "Sijaelewa vizuri. Ninaweza kuzungumza kuhusu: lishe, mazoezi, sukari, msongo, dawa. Tafadhali jaribu tena.",
        error: "Samahani, niko katika matengenezo. Usisahau kunywa maji!"
    },
    tsh: {
        emergency: "Dimuka : Bua maladi ya bunene (mpasi ya ntulu, dipama dia kupema, tshilonda tsha dikasa, mitungisi ya mesu), ndaku kudi muganga nokinoki.",
        nutrition: "Dia bidia bia glycemiki ya panshi (matamba, bidia bia cereale, nyama ya mashi). Sangisha ba proteines na ba fibres na glucides yebe.",
        exercise: "Kuenza sport miniti 30 dituku na dituku dikwasha bua glycemie. Kutambuka nokinoki kudi kuimpe. Tala taux yebe kumpala na nyima ya sport.",
        glucose_tracking: "Kuenza bimpe mvua ne mvua nkudiangaja. Fumina ba valeurs yebe mu dinda ne nsima ya bidia. Glycemie ya buimpe mu dinda idi 70-100 mg/dL.",
        mental_health: "Diabete udi mua kupeta stress. Stress udi ubongola glycemie yebe. Kamata diba dia kupemena ne lala bimpe.",
        medication: "Londa ordonnance yebe bimpe. Bu ubosane anyi udi na ba effets secondaires, bikila muganga webe. Tala date ya insuline yebe.",
        general: "Muoyo ! Ndi GlucoBot. Ndi mua kukwasha na malongesha a bidia, sport, glycemie anyi bien-etre yebe.",
        unknown: "Tshiena mumanye mua kulondolola to. Ndi mua kuakula ne wewe bua: bidia, sport, glycemie, stress, nkisi. Meka kuamba mu njila yisatu.",
        error: "Lumbuluisha, ndi mu bobongisi. Kubosana te kumena mai !"
    },
    kg: {
        emergency: "Keba : Mpo na maladi ya makasi (mpasi ya ntulu, mpasi ya kupema, mpota na lokolo, mitungisi ya meso), kwenda na nganga to na lopitalo nokinoki.",
        nutrition: "Dia bilei ya glycemiki ya nse (ndunda, bilei ya cereale, madesu). Sangisa ba proteines na ba fibres na glucides na nge.",
        exercise: "Kusala sport miniti 30 lumbu na lumbu kusadisaka mingi mpo na glycemie. Kutambula nokinoki kuzali mbote. Tala taux na nge kumpala ye nsima ya sport.",
        glucose_tracking: "Kusala yango mvua ne mvua kuzali fungola. Sonika ba valeurs na nge na nsuka ye nsima ya bilei. Glycemie ya mbote na nsuka kuzali 70-100 mg/dL.",
        mental_health: "Diabete lenda kupesa stress. Stress kuzali kubadula glycemie na nge. Kamata ntangu ya kupemena ye lala mbote.",
        medication: "Landa ordonnance na nge mbote. Kansi ubosane to uzali na ba effets secondaires, bikila nganga na nge. Tala date ya insuline na nge.",
        general: "Mbote ! Mono nzali GlucoBot. Nzali lenda kusadisa nge na malongi ya bilei, sport, glycemie to bien-etre na nge.",
        unknown: "Ke yazabi ve ndenge ya kulondolola. Nzali lenda kusolula na nge mpo na: bilei, sport, glycemie, stress, nkisi. Meka kulanda na ndinga mosusu.",
        error: "Bolimbisi, nzali na bobongisi. Kubosana te kumela mamba !"
    }
};
