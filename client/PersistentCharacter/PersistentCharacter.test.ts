import { CombatantState } from "../../common/CombatantState";
import { EncounterState } from "../../common/EncounterState";
import { PersistentCharacter } from "../../common/PersistentCharacter";
import { StatBlock } from "../../common/StatBlock";
import { AccountClient } from "../Account/AccountClient";
import { SaveEncounterPrompt } from "../Prompts/SaveEncounterPrompt";
import { InitializeSettings } from "../Settings/Settings";
import { LegacySynchronousLocalStore } from "../Utility/LegacySynchronousLocalStore";
import { buildEncounter } from "../test/buildEncounter";
import {
  AccountBackedLibraries,
  UpdatePersistentCharacter
} from "../Library/Libraries";
import { Store } from "../Utility/Store";
import { Library } from "../Library/Library";

describe("InitializeCharacter", () => {
  it("Should have the current HP of the provided statblock", () => {
    const statBlock = StatBlock.Default();
    statBlock.HP.Value = 10;
    const character = PersistentCharacter.Initialize(statBlock);
    expect(character.CurrentHP).toBe(10);
  });
});

async function makePersistentCharacterLibrary() {
  return new Promise<[Library<PersistentCharacter>, UpdatePersistentCharacter]>(
    resolve => {
      const libraries = new AccountBackedLibraries(
        new AccountClient(),
        storeName => {
          if (storeName === Store.PersistentCharacters) {
            resolve([
              libraries.PersistentCharacters,
              libraries.UpdatePersistentCharacter
            ]);
          }
        }
      );
    }
  );
}

describe("PersistentCharacterLibrary", () => {
  beforeEach(() => {
    localStorage.clear();
    window["$"] = require("jquery");
  });

  function savePersistentCharacterWithName(name: string) {
    const persistentCharacter = PersistentCharacter.Default();
    persistentCharacter.Name = name;
    LegacySynchronousLocalStore.Save(
      LegacySynchronousLocalStore.PersistentCharacters,
      persistentCharacter.Id,
      persistentCharacter
    );
    return persistentCharacter.Id;
  }

  it("Should load stored PersistentCharacters", async () => {
    savePersistentCharacterWithName("Persistent Character");

    const [library] = await makePersistentCharacterLibrary();
    const listings = library.GetListings();
    expect(listings).toHaveLength(1);
    expect(listings[0].Meta().Name).toEqual("Persistent Character");
  });

  it("Should provide the latest version of a Persistent Character", async done => {
    InitializeSettings();

    savePersistentCharacterWithName("Persistent Character");

    const [
      library,
      updatePersistentCharacter
    ] = await makePersistentCharacterLibrary();
    const listing = library.GetListings()[0];
    const persistentCharacter = await listing.GetWithTemplate(
      PersistentCharacter.Default()
    );

    await updatePersistentCharacter(persistentCharacter.Id, {
      CurrentHP: 0
    });

    const updatedPersistentCharacter: PersistentCharacter = await listing.GetWithTemplate(
      PersistentCharacter.Default()
    );
    expect(updatedPersistentCharacter.CurrentHP).toEqual(0);
    done();
  });
});

describe("PersistentCharacter", () => {
  it("Should not save PersistentCharacters with Encounters", async () => {
    const encounter = buildEncounter();
    const [library] = await makePersistentCharacterLibrary();

    encounter.AddCombatantFromPersistentCharacter(
      PersistentCharacter.Default(),
      library.GetListings,
      false
    );

    encounter.AddCombatantFromStatBlock(StatBlock.Default());

    const prompt = SaveEncounterPrompt(
      encounter.ObservableEncounterState(),
      "",
      async savedEncounter => {
        expect(savedEncounter.Combatants.length).toEqual(1);
        return null;
      },
      () => {},
      []
    );

    const formValues = prompt.initialValues;
    formValues.Name = "Test";
    prompt.onSubmit(formValues);

    expect.assertions(1);
  });

  it("Should not allow the same Persistent Character to be added twice", async () => {
    const persistentCharacter = PersistentCharacter.Default();
    const encounter = buildEncounter();
    const [library] = await makePersistentCharacterLibrary();

    encounter.AddCombatantFromPersistentCharacter(
      persistentCharacter,
      library.GetListings
    );
    expect(encounter.Combatants().length).toBe(1);

    encounter.AddCombatantFromPersistentCharacter(
      persistentCharacter,
      library.GetListings
    );
    expect(encounter.Combatants().length).toBe(1);
  });

  it("Should allow the user to save notes", () => {});

  it("Should update the Character when a linked Combatant's hp changes", () => {
    const persistentCharacter = PersistentCharacter.Default();
    const encounter = buildEncounter();

    const update = jest.fn();

    const combatant = encounter.AddCombatantFromPersistentCharacter(
      persistentCharacter,
      update
    );
    combatant.ApplyDamage(1);

    expect(update.mock.calls).toEqual([
      [persistentCharacter.Id, { CurrentHP: 0 }]
    ]);
  });

  it("Should update the combatant statblock when it is edited from the library", () => {});

  it("Should update the library statblock when it is edited from the combatant", () => {});

  it("Should render combatant notes with markdown", () => {});

  it("Should remember persistent characters for autosaved encounter state", () => {
    const encounter = buildEncounter();
    encounter.AddCombatantFromPersistentCharacter(
      PersistentCharacter.Default(),
      () => {}
    );

    const encounterState: EncounterState<CombatantState> = encounter.ObservableEncounterState();
    expect(encounterState.Combatants.length).toEqual(1);
  });
});

describe("FilterDimensions.Level", () => {
  it("Should handle just a number", () => {
    const persistentCharacter = PersistentCharacter.Initialize({
      ...StatBlock.Default(),
      Challenge: "1"
    });
    const filterDimensions = PersistentCharacter.GetFilterDimensions(
      persistentCharacter
    );
    expect(filterDimensions.Level).toEqual("1");
  });

  it("Should handle a class with level", () => {
    const persistentCharacter = PersistentCharacter.Initialize({
      ...StatBlock.Default(),
      Challenge: "Fighter 5"
    });
    const filterDimensions = PersistentCharacter.GetFilterDimensions(
      persistentCharacter
    );
    expect(filterDimensions.Level).toEqual("5");
  });

  it("Should handle multiple classes with levels", () => {
    const persistentCharacter = PersistentCharacter.Initialize({
      ...StatBlock.Default(),
      Challenge: "Fighter 5, Rogue 5"
    });
    const filterDimensions = PersistentCharacter.GetFilterDimensions(
      persistentCharacter
    );
    expect(filterDimensions.Level).toEqual("10");
  });
});

describe("Resolving differences between local storage and account sync", () => {
  it("Should use the local storage persistent character if newer", () => {});
  it("Should use the account sync persistent character if newer", () => {});
});
