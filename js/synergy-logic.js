// Synergy Logic Engine

// Helper: Remove accents and lowercase
function normalizeText(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Search for a job in the database
function findJob(query) {
    const normQuery = normalizeText(query);
    // 1. Exact match (normalized)
    const exact = jobsDatabase.find(j => normalizeText(j.label) === normQuery);
    if (exact) return exact;

    // 2. Starts with
    const starts = jobsDatabase.find(j => normalizeText(j.label).startsWith(normQuery));
    if (starts) return starts;

    // 3. Includes
    const includes = jobsDatabase.find(j => normalizeText(j.label).includes(normQuery));
    if (includes) return includes;

    return null;
}

// Get Synergies
function getSynergies(inputJob) {
    if (!inputJob) return [];

    const candidates = jobsDatabase.filter(j => j.id !== inputJob.id);
    
    const scoredCandidates = candidates.map(candidate => {
        let score = 0;

        // 1. Sphere Synergy (The "Recipe")
        // Define high-level affinity between spheres
        const sphereAffinity = {
            'habitat': ['conseil', 'business', 'commerce'],
            'business': ['commerce', 'conseil', 'habitat'],
            'bien-etre': ['commerce', 'sante', 'business'],
            'commerce': ['business', 'habitat', 'bien-etre'],
            'conseil': ['business', 'habitat', 'commerce'],
            'sante': ['bien-etre', 'conseil']
        };

        // 2. Same Sphere (Peers/Competitors can be partners too, but less likely for "synergy" vs "referral")
        // We give it a small bonus because sometimes you need a partner in your field (e.g. Architect + Decorator)
        if (inputJob.sphere === candidate.sphere) {
            score += 40; // BOOSTED from 10: Intra-sphere is often the BEST synergy (e.g. Coach + Nutri)
        }
        
        // 2b. Cross-Sphere Bonus (Complementarity)
        // If not same sphere, but compatible sphere
        else if (sphereAffinity[inputJob.sphere]?.includes(candidate.sphere)) {
            score += 30;
        }

        // 3. Tag Matching (The "Context")
        // e.g. 'mariage' connects Fleuriste (Commerce) and Photographe (Business)
        const sharedTags = inputJob.tags.filter(tag => candidate.tags.includes(tag));
        score += (sharedTags.length * 20);

        // 4. Specific "Power Couples" (Hardcoded Logic via ID checks if needed)
        // Example: Immo + Notaire is classic
        if (inputJob.id.includes('immo') && candidate.id.includes('notaire')) score += 50;
        if (inputJob.id.includes('notaire') && candidate.id.includes('immo')) score += 50;
        
        // Example: Coach Sportif + Nutritionniste
        if (inputJob.id.includes('sport') && candidate.id.includes('nutri')) score += 50;
        if (inputJob.id.includes('nutri') && candidate.id.includes('sport')) score += 50;

        // Example: Webdesigner + SEO
        if (inputJob.id.includes('web') && candidate.id.includes('seo')) score += 50;
        if (inputJob.id.includes('seo') && candidate.id.includes('web')) score += 50;

        // FIX: Photographe + CM / Immo / Web
        if (inputJob.id.includes('photo') && (candidate.id.includes('cm') || candidate.id.includes('immo') || candidate.id.includes('web'))) score += 50;
        if ((inputJob.id.includes('cm') || inputJob.id.includes('immo') || inputJob.id.includes('web')) && candidate.id.includes('photo')) score += 50;

        // FIX: Nutritionniste + Coach Sportif / Naturopathe
        if (inputJob.id.includes('nutri') && (candidate.id.includes('sport') || candidate.id.includes('naturo'))) score += 50;
        if ((inputJob.id.includes('sport') || inputJob.id.includes('naturo')) && candidate.id.includes('nutri')) score += 50;

        // FIX: Architecte + Immo / Paysagiste
        if (inputJob.id.includes('archi') && (candidate.id.includes('immo') || candidate.id.includes('paysagiste'))) score += 50;
        if ((inputJob.id.includes('immo') || inputJob.id.includes('paysagiste')) && candidate.id.includes('archi')) score += 50;

        // FIX: Wedding Planner + Fleuriste / Traiteur
        if (inputJob.id.includes('wedding') && (candidate.id.includes('fleuriste') || candidate.id.includes('traiteur') || candidate.id.includes('photo'))) score += 50;
        if ((inputJob.id.includes('fleuriste') || inputJob.id.includes('traiteur') || inputJob.id.includes('photo')) && candidate.id.includes('wedding')) score += 50;

        // 5. Randomness (Spice) - Reduced to keep high scores relevant
        score += Math.random() * 2; // Was 5

        return { ...candidate, score, sharedTags };
    });

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // DIVERSIFY RESULTS: Force variety in top 7
    let topResults = [];
    let usedMissions = new Set();
    
    // Helper to get synergy details
    const getSyn = (c) => getSynergyDescription(inputJob, c);

    // 1. ABSOLUTE BEST MATCH (The "Wow" Card)
    if (scoredCandidates.length > 0) {
        const best = scoredCandidates[0];
        topResults.push(best);
        usedMissions.add(getSyn(best).name);
    }

    // 2. FORCE ONE CARD PER MISSION TYPE (If available)
    // We iterate through candidate list to find the best match for each missing mission type
    const requiredMissions = [
        'LE JOKER', 
        'LE PRESCRIPTEUR', 
        'LE MENTOR', 
        'LE VEILLEUR', 
        "L'INFILTRÉ", 
        'LE PORTIER', 
        "L'AMPLIFICATEUR"
    ];

    for (const mType of requiredMissions) {
        if (topResults.length >= 7) break; // We only want 7 cards displayed first
        if (usedMissions.has(mType)) continue;

        // Find the highest scoring candidate that yields this mission
        // BUT RELAX THE SPHERE CONSTRAINT if needed to find variety
        let candidate = scoredCandidates.find(c => 
            !topResults.includes(c) && getSyn(c).name === mType
        );
        
        // If not found in top candidates, search DEEPER in the whole list
        if (!candidate) {
             candidate = scoredCandidates.find(c => 
                !topResults.includes(c) && getSyn(c).name === mType
            );
        }

        if (candidate) {
            topResults.push(candidate);
            usedMissions.add(mType);
        }
    }

    // 3. Fill the rest if we couldn't find 7 unique missions
    for (const candidate of scoredCandidates) {
        if (topResults.length >= 20) break;
        if (!topResults.includes(candidate)) {
            topResults.push(candidate);
        }
    }
    
    return topResults;
}

// Generate Synergy Description based on context
function getSynergyDescription(job1, job2) {
    const ids = [job1.id, job2.id].sort(); // Sort to ensure order doesn't matter
    const pair = ids.join('|');

    // --- 0. HELPER: Mission Definitions ---
    const missions = {
        portier: { 
            icon: 'fa-door-open', 
            name: 'LE PORTIER', 
            desc: "<strong>Action Directe</strong><br>Ouvre les portes fermées.<br><br>Accédez directement au décideur que vous n'arrivez pas à joindre.", 
            color: 'linear-gradient(135deg, #8b5cf6, #6366f1)' 
        }, // Purple
        prescripteur: { 
            icon: 'fa-bullhorn', 
            name: 'LE PRESCRIPTEUR', 
            desc: "<strong>Action Directe</strong><br>Vend à votre place.<br><br>Il transfère sa crédibilité pour rassurer vos futurs clients.", 
            color: 'linear-gradient(135deg, #10b981, #059669)' 
        }, // Green
        amplificateur: { 
            icon: 'fa-wifi', 
            name: "L'AMPLIFICATEUR", 
            desc: "<strong>Action Directe</strong><br>Booste votre visibilité.<br><br>Il diffuse votre message à sa communauté pour toucher plus de monde.", 
            color: 'linear-gradient(135deg, #3b82f6, #2563eb)' 
        }, // Blue
        infiltre: { 
            icon: 'fa-user-secret', 
            name: "L'INFILTRÉ", 
            desc: "<strong>Action Directe</strong><br>Donne l'info avant tout le monde.<br><br>Soyez le premier sur le coup grâce à une info confidentielle.", 
            color: 'linear-gradient(135deg, #f43f5e, #e11d48)' 
        }, // Red/Rose
        mentor: { 
            icon: 'fa-lightbulb', 
            name: 'LE MENTOR', 
            desc: "<strong>Action Directe</strong><br>Débloque la situation.<br><br>Une expertise technique immédiate pour résoudre votre problème.", 
            color: 'linear-gradient(135deg, #f59e0b, #d97706)' 
        }, // Amber
        joker: { 
            icon: 'fa-handshake', 
            name: 'LE JOKER', 
            desc: "<strong>Action Directe</strong><br>Complète votre offre.<br><br>Associez-vous pour répondre à un besoin client que vous ne couvrez pas seul.", 
            color: 'linear-gradient(135deg, #ec4899, #db2777)' 
        }, // Pink
        veilleur: { 
            icon: 'fa-binoculars', 
            name: 'LE VEILLEUR', 
            desc: "<strong>Action Directe</strong><br>Surveille votre marché.<br><br>Il est vos yeux et vos oreilles sur le terrain pour détecter les opportunités.", 
            color: 'linear-gradient(135deg, #14b8a6, #0d9488)' 
        } // Teal
    };

    // Helper: Guess sphere from keywords
    function guessSphere(name) {
        const lowerName = normalizeText(name);
        if (lowerName.match(/maison|batiment|travaux|jardin|immo|deco|archi|maitre/)) return 'habitat';
        if (lowerName.match(/soin|medecin|therapeute|sante|bien-etre|coach|psy|osteo/)) return 'bien-etre';
        if (lowerName.match(/vente|boutique|magasin|resto|bar|commerce|vin|traiteur/)) return 'commerce';
        if (lowerName.match(/conseil|consultant|audit|expert|droit|loi|avocat|notaire/)) return 'conseil';
        if (lowerName.match(/digital|web|marketing|com|gestion|business|photo|video/)) return 'business';
        return 'business'; // Default
    }

    // Helper: Create a guest job object
    function createGuestJob(name) {
        return {
            id: 'guest_' + Math.random().toString(36).substr(2, 9),
            label: name.charAt(0).toUpperCase() + name.slice(1),
            sphere: guessSphere(name),
            tags: [] // No tags for guest jobs, rely on sphere logic
        };
    }

    // --- 1. SPECIFIC POWER COUPLES (Override) ---
    const powerCouples = {
        // --- HABITAT ---
        'immo_agent|immo_notaire': { mission: 'prescripteur', desc: "Flux d'affaires constant : chaque vente a besoin d'un acte." },
        'immo_agent|immo_courtier': { mission: 'portier', desc: "Verrouillez le financement de vos acheteurs en amont." },
        'immo_agent|immo_diagnostiqueur': { mission: 'joker', desc: "Réactivité maximale pour signer les mandats sans attendre." },
        'immo_agent|immo_architecte': { mission: 'amplificateur', desc: "Aidez l'acheteur à se projeter avec des plans 3D." },
        'immo_agent|btp_paysagiste': { mission: 'amplificateur', desc: "Un jardin valorisé = +10% sur le prix de vente." },
        'btp_macon|immo_architecte': { mission: 'joker', desc: "Duo Conception + Réalisation pour rassurer le client." },
        'btp_electricien|dig_domotique': { mission: 'infiltre', desc: "Proposez la maison connectée avant même la fin du chantier." },
        'immo_agent|dig_photographe_corp': { mission: 'amplificateur', desc: "Des photos pro font cliquer 5x plus sur les annonces." },
        'btp_menuisier|btp_cuisiniste': { mission: 'joker', desc: "Le duo technique parfait pour des cuisines sur-mesure." },
        'btp_menuisier|immo_agent': { mission: 'prescripteur', desc: "Recommandez-vous pour les travaux avant/après vente." },
        'btp_menuisier|btp_domotique': { mission: 'infiltre', desc: "Intégrez la tech dans le mobilier ou les ouvertures." },

        // --- SANTÉ & BIEN-ÊTRE ---
        'sante_coach_sport|sante_nutri': { mission: 'joker', desc: "Offre 'Transformation' : Sport + Assiette." },
        'sante_osteo|sante_kine': { mission: 'prescripteur', desc: "L'un débloque, l'autre rééduque. Parcours de soin logique." },
        'sante_naturopathe|com_magasin_bio': { mission: 'portier', desc: "Prescrivez les produits que votre partenaire vend." },
        'be_coiffeur|be_esthetique': { mission: 'joker', desc: "Pack 'Mise en Beauté' pour mariages et événements." },
        'be_sophrologue|sante_psy': { mission: 'prescripteur', desc: "Approches complémentaires pour la gestion du stress." },
        
        // NUTRITIONNISTE SPECIFIC (Fix User Feedback)
        'sante_nutri|sante_naturo': { mission: 'joker', desc: "Approche globale : Alimentation (Nutri) + Hygiène de vie (Naturo)." },
        'sante_nutri|sante_dentiste': { mission: 'prescripteur', desc: "Santé bucco-dentaire et sucre : un discours de prévention commun." },
        'sante_nutri|sante_sophro': { mission: 'joker', desc: "Gestion des troubles alimentaires (TCA) par la relaxation." },
        'sante_nutri|be_coiffeur': { mission: 'amplificateur', desc: "La santé du cheveu passe par l'assiette. Conseil beauté global." },
        'sante_nutri|sante_osteo': { mission: 'mentor', desc: "Inflammation et alimentation : soulagez les douleurs durablement." },
        'sante_dentiste|be_sophrologue': { mission: 'prescripteur', desc: "Gestion du stress et de la phobie du dentiste." },
        'be_coiffeur|sante_sophro': { mission: 'veilleur', desc: "Le salon de coiffure est le lieu de la confidence. Orientez si besoin." },
        'sante_nutri|sante_kine': { mission: 'infiltre', desc: "La nutrition sportive pour optimiser la rééducation." },
        
        // --- BUSINESS & DIGITAL ---
        'biz_comptable|biz_avocat_aff': { mission: 'mentor', desc: "Le bouclier du dirigeant : Fiscalité + Juridique." },
        'biz_comptable|biz_banquier_pro': { mission: 'portier', desc: "Un bilan certifié facilite l'obtention du crédit pro." },
        'dig_webdesigner|dig_seo': { mission: 'joker', desc: "Site Beau (Web) + Site Vu (SEO) = Client Heureux." },
        'dig_webdesigner|dig_copywriter': { mission: 'amplificateur', desc: "Le design attire l'œil, les mots déclenchent l'achat." },
        'dig_cm|dig_photographe_corp': { mission: 'amplificateur', desc: "Contenu visuel premium pour nourrir les réseaux sociaux." },
        'biz_assureur|biz_comptable': { mission: 'veilleur', desc: "Anticipez les risques financiers et matériels du client." },

        // --- COMMERCE & ÉVÉNEMENTIEL ---
        'com_wedding|com_fleuriste': { mission: 'joker', desc: "La signature visuelle du mariage repose sur vous deux." },
        'com_wedding|com_traiteur': { mission: 'portier', desc: "Le chef d'orchestre et le soliste de la réception." },
        'com_wedding|dig_photographe_event': { mission: 'prescripteur', desc: "Immortalisez l'événement que l'autre organise." },
        'com_restaurateur|com_caviste': { mission: 'mentor', desc: "Créez une carte des vins exclusive et rentables." },
        'com_pret_a_porter|be_conseil_image': { mission: 'joker', desc: "Coaching style en boutique pour booster le panier moyen." },

        // --- CONSEIL ---
        'cons_rh|biz_avocat_droit_social': { mission: 'infiltre', desc: "Gestion des conflits : préventif (RH) et curatif (Avocat)." },
        'cons_gestion|biz_banquier_pro': { mission: 'prescripteur', desc: "Redressez les comptes pour débloquer les financements." },
        
        // CROSS-SPHERE (La magie opère ici) ---
        'immo_agent|biz_avocat_aff': { mission: 'infiltre', desc: "Détectez les ventes de fonds de commerce avant le marché." },
        'btp_menuisier|biz_gestion_patrimoine': { mission: 'veilleur', desc: "J'entends parler de projets d'investissement locatif." }, // Exemple utilisateur
        'btp_menuisier|immo_architecte': { mission: 'portier', desc: "Je réalise les agencements sur-mesure de tes plans." }, // Exemple utilisateur
        'sante_nutri|com_restaurateur': { mission: 'amplificateur', desc: "Créez un menu 'Santé/Healthy' validé par le pro." }, // Exemple utilisateur
        'biz_expert_comptable|immo_agent': { mission: 'veilleur', desc: "Je vois les bilans : je sais qui va investir ou vendre." },
        'dig_community_mgr|com_boutique': { mission: 'amplificateur', desc: "Transformez le trafic piéton en communauté Instagram." },
        'btp_menuisier|com_restaurateur': { mission: 'joker', desc: "Aménagement de terrasse ou mobilier bois sur-mesure." },
        'immo_agent|sante_nutri': { mission: 'veilleur', desc: "Le stress du déménagement influe sur la santé. Offrez un bilan." },
        'btp_menuisier|dig_webdesigner': { mission: 'amplificateur', desc: "Montrez votre savoir-faire artisanal avec un site vitrine." },
        'btp_menuisier|immo_notaire': { mission: 'infiltre', desc: "Lors d'une succession, il y a souvent des travaux à prévoir." }
    };

    if (powerCouples[pair]) {
        const pc = powerCouples[pair];
        const m = missions[pc.mission];
        // Only override if specific desc provided, else use default mission desc
        return { ...m }; 
    }

    // FIX: Flexible Photographe Rule
    if (job1.id.includes('photo') || job2.id.includes('photo')) {
        return { ...missions.amplificateur };
    }

    // --- 2. LOGIC BASED ON JOB TYPES (The "Rules") ---

    // RULE A: Digital Jobs are AMPLIFIERS for everyone else
    if (job1.sphere === 'business' && job1.id.startsWith('dig_') && job2.sphere !== 'business') {
        return { ...missions.amplificateur };
    }
    if (job2.sphere === 'business' && job2.id.startsWith('dig_') && job1.sphere !== 'business') {
        return { ...missions.amplificateur };
    }

    // RULE B: Legal/Finance are INFILTRÉS (Know secrets/projects early)
    const isInfiltre = (j) => ['biz_comptable', 'biz_avocat', 'immo_notaire', 'biz_banquier'].some(k => j.id.includes(k));
    if (isInfiltre(job1) || isInfiltre(job2)) {
        return { ...missions.infiltre };
    }

    // RULE C: High Volume Connectors are PORTIERS
    const isPortier = (j) => ['immo_agent', 'com_restaurateur', 'biz_assureur'].some(k => j.id.includes(k));
    if (isPortier(job1) && !isPortier(job2)) return { ...missions.portier };
    if (isPortier(job2) && !isPortier(job1)) return { ...missions.portier };

    // RULE D: Consultants/Coaches are MENTORS ... BUT ONLY if the other side needs mentoring
    const isMentor = (j) => j.id.includes('consultant') || j.id.includes('coach');
    
    if (isMentor(job1) && !isMentor(job2)) {
        // I am the mentor. What is the partner?
        // --- CUSTOM FIX FOR USER FEEDBACK: Menuisier + Mentor != Mentor (but Portier or Veilleur) ---
        if (job2.sphere === 'habitat') return { ...missions.veilleur };
        return { ...missions.mentor };
    }
    
    if (isMentor(job2) && !isMentor(job1)) {
        // Partner is the mentor.
        // --- CUSTOM FIX FOR USER FEEDBACK: Menuisier + Mentor != Mentor (but Portier or Veilleur) ---
        if (job1.sphere === 'habitat') return { ...missions.veilleur };
        return { ...missions.mentor };
    }
    
    if (isMentor(job1) && isMentor(job2)) {
        // Two mentors -> Joker or Prescripteur
        return { ...missions.prescripteur };
    }

    // RULE E: Local Commerce are VEILLEURS
    if (job1.sphere === 'commerce' || job2.sphere === 'commerce') {
        return { ...missions.veilleur };
    }

    // RULE F: Same Sphere / Shared Tags -> JOKER
    const sharedTags = job1.tags.filter(tag => job2.tags.includes(tag));
    if (job1.sphere === job2.sphere) {
        // Diversify within same sphere to avoid 7 Jokers
        const sphereMissions = {
            'habitat': ['LE JOKER', 'LE PRESCRIPTEUR', 'LE VEILLEUR', "L'INFILTRÉ"],
            'business': ['LE MENTOR', 'LE JOKER', "L'AMPLIFICATEUR", 'LE PORTIER'],
            'sante': ['LE PRESCRIPTEUR', 'LE MENTOR', 'LE JOKER'],
            'commerce': ['LE VEILLEUR', "L'AMPLIFICATEUR", 'LE PORTIER'],
            'conseil': ['LE MENTOR', "L'INFILTRÉ", 'LE PRESCRIPTEUR']
        };
        
        // Use job ID hash to deterministically pick a mission if multiple are available
        // This ensures variety between different pairs in the same sphere
        const hash = (job1.id.length + job2.id.length);
        const available = sphereMissions[job1.sphere] || ['LE PRESCRIPTEUR'];
        const missionName = available[hash % available.length];
        
        // Return the mission object based on name
        const missionKey = Object.keys(missions).find(k => missions[k].name === missionName);
        return { ...missions[missionKey] };
    }

    // FALLBACK: PRESCRIPTEUR
    return { ...missions.prescripteur };
}
