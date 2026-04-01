import {
  normalizarGrupo,
  grupoCoincide,
  alumnoPerteneceAGrupos,
} from './grupo.utils';

describe('grupo.utils', () => {
  describe('normalizarGrupo', () => {
    it('debe retornar string vacío para null/undefined', () => {
      expect(normalizarGrupo(null)).toBe('');
      expect(normalizarGrupo(undefined)).toBe('');
    });

    it('debe hacer trim y mayúsculas', () => {
      expect(normalizarGrupo('  a  ')).toBe('A');
      expect(normalizarGrupo('b')).toBe('B');
    });
  });

  describe('grupoCoincide', () => {
    it('debe coincidir cuando grado y grupo normalizado son iguales', () => {
      expect(grupoCoincide(1, 'A', 1, 'a')).toBe(true);
      expect(grupoCoincide(2, '  b  ', 2, 'B')).toBe(true);
    });

    it('no debe coincidir cuando grado es distinto', () => {
      expect(grupoCoincide(1, 'A', 2, 'A')).toBe(false);
    });

    it('no debe coincidir cuando grupo es distinto', () => {
      expect(grupoCoincide(1, 'A', 1, 'B')).toBe(false);
    });
  });

  describe('alumnoPerteneceAGrupos', () => {
    it('retorna false si no hay grupos del maestro', () => {
      expect(alumnoPerteneceAGrupos({ grado: 1, grupo: 'A' }, [])).toBe(false);
      expect(alumnoPerteneceAGrupos({ grado: 1, grupo: 'A' }, [{ grupo: null }])).toBe(false);
    });

    it('prioriza grupoId cuando está presente', () => {
      const maestroGrupos = [
        { grupo: { id: 5, grado: 1, nombre: 'A' } },
        { grupo: { id: 6, grado: 1, nombre: 'B' } },
      ];
      expect(alumnoPerteneceAGrupos({ grupoId: 5, grado: 1, grupo: 'X' }, maestroGrupos)).toBe(
        true,
      );
      expect(alumnoPerteneceAGrupos({ grupoId: 99, grado: 1, grupo: 'A' }, maestroGrupos)).toBe(
        false,
      );
    });

    it('usa grado+grupo cuando no hay grupoId', () => {
      const maestroGrupos = [
        { grupo: { id: 5, grado: 1, nombre: 'A' } },
        { grupo: { id: 6, grado: 2, nombre: 'B' } },
      ];
      expect(alumnoPerteneceAGrupos({ grado: 1, grupo: 'a' }, maestroGrupos)).toBe(true);
      expect(alumnoPerteneceAGrupos({ grado: 2, grupo: 'B' }, maestroGrupos)).toBe(true);
      expect(alumnoPerteneceAGrupos({ grado: 1, grupo: 'B' }, maestroGrupos)).toBe(false);
    });
  });
});
