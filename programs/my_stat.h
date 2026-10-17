#ifndef MY_STAT_H
#define MY_STAT_H

/* config.h leaves HAVE_SYS_STAT_H unset when configure never checks for the
   header. Emscripten still provides <sys/stat.h>, and C99 rejects the
   implicit stat/fstat/S_ISREG declarations that the fallback struct needs. */
#if defined(HAVE_SYS_STAT_H)
#  include <sys/stat.h>
#  define MY_STAT_HAVE_HEADER 1
#elif !defined(_MSC_VER) && defined(__has_include)
#  if __has_include(<sys/stat.h>)
#    include <sys/stat.h>
#    define MY_STAT_HAVE_HEADER 1
#  endif
#endif

#ifndef MY_STAT_HAVE_HEADER
#  include <stdint.h>
#  if defined _MSC_VER
struct _stat
#  else
struct stat
#  endif
{
  uint32_t st_dev;
  uint32_t st_ino;
  uint16_t st_mode;
  int16_t st_nlink;
  int16_t st_uid;
  int16_t st_gid;
  uint32_t st_rdev;
  size_t st_size;
  size_t st_atime;
  size_t st_mtime;
  size_t st_ctime;
};
#endif

#if defined _MSC_VER && !defined MY_STAT_HAVE_HEADER
typedef struct _stat struct_stat_t;
#else
typedef struct stat struct_stat_t;
#endif

#if defined _MSC_VER
int _access (const char *path, int mode);
#  define access(fn, m) _access (fn, m)
#  ifndef S_ISREG
#    define S_ISREG(m) ((m & 0170000) == _S_IFREG)
#  endif
#  ifndef S_ISDIR
#    define S_ISDIR(m) ((m & 0170000) == _S_IFDIR)
#  endif
#  ifndef W_OK
#    define W_OK 0
#  endif
#endif // _MSC_VER

#endif // MY_STAT_H
